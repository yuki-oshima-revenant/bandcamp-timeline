use mail_parser::{HeaderValue, Message};
use regex::Regex;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
extern crate dotenv;
use aws_sdk_dynamodb;
use aws_sdk_dynamodb::model::AttributeValue;
use aws_sdk_s3;
use aws_sdk_sns;
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
struct ForwardMailData {
    subject: String,
    from: String,
    body: String,
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
    let sns_client = aws_sdk_sns::Client::new(&aws_config);
    let s3_bucket = &event.records[0].s3.bucket.name;
    let s3_key = &event.records[0].s3.object.key;
    let mail = get_mail(s3_client, s3_bucket, s3_key).await;
    let message = Message::parse(mail.as_slice()).unwrap();
    let from = extract_address(&message).unwrap();
    if from == "noreply@bandcamp.com" {
        match parse_bandcamp_mail(&message) {
            Ok(mail_data) => {
                insert_data(dynamo_client, mail_data).await;
                return Ok(SuccessResponse {});
            }
            Err(message) => {
                println!("invalid mail: {}", message);
                return Ok(SuccessResponse {});
            }
        }
    } else {
        let body = parse_forward_mail(&message);
        forward_mail(sns_client, body, s3_bucket, s3_key).await;
        Ok(SuccessResponse {})
    }
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

fn extract_address(message: &Message) -> Option<String> {
    match message.get_from() {
        HeaderValue::Address(from) => Some(from.address.to_owned().unwrap().into_owned()),
        _ => None,
    }
}

fn parse_bandcamp_mail(message: &Message) -> Result<MailData, String> {
    let to = match message.get_to() {
        HeaderValue::Address(a) => Some(a),
        _ => None,
    }
    .unwrap();
    let date = message.get_date().unwrap().to_iso8601();
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
        None => return Err(String::from("\"released\" clause not found.")),
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
    Ok(MailData {
        to: to.address.to_owned().unwrap().into_owned(),
        date,
        label,
        title,
        artist,
        link,
        cover_link,
    })
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

fn parse_forward_mail(message: &Message) -> ForwardMailData {
    let body = Regex::new(r"[\r]?\n")
        .unwrap()
        .replace_all(message.get_text_body(0).unwrap().as_ref(), " ")
        .into_owned();
    ForwardMailData {
        subject: message.get_subject().unwrap().to_owned(),
        from: extract_address(&message).unwrap(),
        body,
    }
}

async fn forward_mail(
    sns_client: aws_sdk_sns::Client,
    body: ForwardMailData,
    s3_bucket: &String,
    s3_key: &String,
) {
    sns_client
        .publish()
        .topic_arn("arn:aws:sns:ap-northeast-1:621702102095:forward-from-mailparser")
        .message(format!(
            "forward from mailparser\n\ns3_bucket: {}\n\ns3_key: {}\n\nForwardMailData: {}",
            s3_bucket,
            s3_key,
            serde_json::to_string_pretty(&body).unwrap()
        ))
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
    async fn test_parse_bandcamp_mail() {
        dotenv().ok();
        let aws_config = aws_config::from_env().load().await;
        let s3_client = aws_sdk_s3::Client::new(&aws_config);
        let mail = get_mail(
            s3_client,
            &String::from("mailrecieve.unronritaro.net"),
            &String::from("BCdaIfbZSr6YhE2x8XM3BQ.eml"),
        )
        .await;
        let message = Message::parse(mail.as_slice()).unwrap();
        let mail_data = parse_bandcamp_mail(&message);
        println!("{}", serde_json::to_string_pretty(&mail_data).unwrap());
    }
    #[tokio::test]
    async fn test_forward_mail() {
        dotenv().ok();
        let aws_config = aws_config::from_env().load().await;
        let s3_client = aws_sdk_s3::Client::new(&aws_config);
        let sns_client = aws_sdk_sns::Client::new(&aws_config);
        let s3_bucket = &String::from("mailrecieve.unronritaro.net");
        let s3_key = &String::from("BCdaIfbZSr6YhE2x8XM3BQ.eml");

        let mail = get_mail(s3_client, s3_bucket, s3_key).await;
        let message = Message::parse(mail.as_slice()).unwrap();
        let body = parse_forward_mail(&message);
        forward_mail(sns_client, body, s3_bucket, s3_key).await;
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
