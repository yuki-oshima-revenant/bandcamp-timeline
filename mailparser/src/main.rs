use core::panic;
use mail_parser::{HeaderValue, Message};
use regex::Regex;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
extern crate dotenv;
use aws_sdk_dynamodb;
use aws_sdk_dynamodb::model::AttributeValue;
use aws_sdk_s3;
use lambda_runtime;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MailData {
    to: String,
    date: String,
    label: String,
    title: String,
    artist: Option<String>,
    link: String,
    cover_link: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Bucket {
    name: String,
    arn: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Object {
    key: String,
    size: usize,

    #[serde(rename = "eTag")]
    etag: String,

    sequencer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct S3Data {
    bucket: Bucket,
    object: Object,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    event_source: String,
    aws_region: String,
    s3: S3Data,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct S3PutEvent {
    #[serde(rename = "Records")]
    records: Vec<Record>,
}

#[derive(Debug, Serialize)]
struct SuccessResponse {
    // pub body: String,
}

#[derive(Debug, Serialize)]
struct FailureResponse {
    pub body: String,
}

impl std::fmt::Display for FailureResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.body)
    }
}

impl std::error::Error for FailureResponse {}

type Response = Result<SuccessResponse, FailureResponse>;

#[tokio::main]
async fn main() -> Result<(), lambda_runtime::Error> {
    let func = lambda_runtime::handler_fn(handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn handler(event: S3PutEvent, _ctx: lambda_runtime::Context) -> Response {
    let aws_config = aws_config::from_env().load().await;
    let s3_client = aws_sdk_s3::Client::new(&aws_config);
    let dynamo_client = aws_sdk_dynamodb::Client::new(&aws_config);
    let mail = get_mail(
        s3_client,
        &event.records[0].s3.bucket.name,
        &event.records[0].s3.object.key,
    )
    .await;
    let mail_data = parse(mail).await;
    insert_data(dynamo_client, mail_data).await;
    Ok(SuccessResponse {})
}

async fn get_mail(
    s3_client: aws_sdk_s3::Client,
    bucket_name: &String,
    object_key: &String,
) -> Vec<u8> {
    let response = s3_client
        .get_object()
        .bucket(bucket_name)
        .key(object_key)
        .send()
        .await
        .unwrap();
    response.body.collect().await.unwrap().into_bytes().to_vec()
}

async fn parse(mail_bytes: Vec<u8>) -> MailData {
    let message = Message::parse(mail_bytes.as_slice()).unwrap();
    let to = match message.get_to() {
        HeaderValue::Address(a) => Some(a),
        _ => None,
    }
    .unwrap();
    let date = message.get_date().unwrap().to_iso8601();
    let from = match message.get_from() {
        HeaderValue::Address(a) => Some(a),
        _ => None,
    }
    .unwrap();
    assert_eq!(from.address.as_ref().unwrap(), "noreply@bandcamp.com");
    let body = message.get_html_body(0).unwrap();
    let document = Html::parse_document(body.as_ref());
    let div_element = document
        .select(&Selector::parse("div").unwrap())
        .into_iter()
        .next()
        .unwrap();
    let mut texts = div_element.text().collect::<Vec<&str>>().into_iter();
    let label = match texts.find(|x| Regex::new(r"released").unwrap().is_match(x)) {
        Some(str) => str.replace(" just released ", "").replace("\n", ""),
        None => panic!("\"released\" clause not found."),
    };
    let title = texts.next().unwrap().to_owned();
    let artist = match texts.find(|x| Regex::new(r"by").unwrap().is_match(x)) {
        Some(str) => Some(str.replace(" by ", "").replace("\n", "").replace(", ", "")),
        None => None,
    };
    let a_element = div_element
        .select(&Selector::parse("a").unwrap())
        .next()
        .unwrap();
    let link = Regex::new(r"\?.*")
        .unwrap()
        .replace(a_element.value().attr("href").unwrap(), "")
        .into_owned();
    let img_element = a_element
        .select(&Selector::parse("img").unwrap())
        .next()
        .unwrap();
    let cover_link = img_element.value().attr("src").unwrap().to_owned();
    MailData {
        to: to.address.to_owned().unwrap().into_owned(),
        date,
        label,
        title,
        artist,
        link,
        cover_link,
    }
}

async fn insert_data(dynamo_client: aws_sdk_dynamodb::Client, mail_data: MailData) {
    dynamo_client
        .put_item()
        .table_name("bandcamp_release")
        .item("to", AttributeValue::S(mail_data.to))
        .item("date", AttributeValue::S(mail_data.date))
        .item("label", AttributeValue::S(mail_data.label))
        .item("title", AttributeValue::S(mail_data.title))
        .item(
            "artist",
            match mail_data.artist {
                Some(artist) => AttributeValue::S(artist),
                None => AttributeValue::Null(true),
            },
        )
        .item("link", AttributeValue::S(mail_data.link))
        .item("cover_link", AttributeValue::S(mail_data.cover_link))
        .send()
        .await
        .unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use dotenv::dotenv;
    // use std::fs;
    #[tokio::test]
    async fn test_parse() {
        dotenv().ok();
        // let mail = fs::read("./data/p1lnu3mp1969b9ii8fnmcm02tk6b04kikcpq17g1").unwrap();
        // let mail = fs::read("./data/773n80qmek46p0d9u6ibcs1o430nrnljucuqt401").unwrap();
        // let mail = fs::read("./data/ulpauftrm00fttu6r9jaa49haqrgn6mf1otqh5g1").unwrap();

        let aws_config = aws_config::from_env().load().await;
        let s3_client = aws_sdk_s3::Client::new(&aws_config);
        let mail = get_mail(
            s3_client,
            &String::from("mailrecieve.unronritaro.net"),
            &String::from("p1lnu3mp1969b9ii8fnmcm02tk6b04kikcpq17g1"),
        )
        .await;
        let mail_data = parse(mail).await;
        println!("{}", serde_json::to_string_pretty(&mail_data).unwrap());
    }
    #[tokio::test]
    async fn test_query_table() {
        dotenv().ok();
        let aws_config = aws_config::from_env().load().await;
        let dynamo_client = aws_sdk_dynamodb::Client::new(&aws_config);
        let query_response = dynamo_client
            .query()
            .table_name("bandcamp_release")
            .key_conditions(
                "to",
                aws_sdk_dynamodb::model::Condition::builder()
                    .comparison_operator(aws_sdk_dynamodb::model::ComparisonOperator::Eq)
                    .attribute_value_list(aws_sdk_dynamodb::model::AttributeValue::S(String::from(
                        "revenant.jumboride@gmail.com",
                    )))
                    .build(),
            )
            .send()
            .await
            .unwrap();
        println!("{:?}", query_response);
    }
}
