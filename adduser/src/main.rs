use argon2::{self, Config};
use dotenv::dotenv;
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};
use std::env;

#[tokio::main]
async fn main() {
    dotenv().ok();
    let args: Vec<String> = env::args().collect();
    let email = &args[1];
    println!("email: {}", email);
    let password: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();
    println!("password: {}", password);
    let salt = env::var("PASSWORD_SALT").unwrap();
    let config = Config::default();
    let hash = argon2::hash_encoded(password.as_bytes(), salt.as_bytes(), &config).unwrap();

    let aws_config = aws_config::from_env().load().await;
    let dynamo_client = aws_sdk_dynamodb::Client::new(&aws_config);
    dynamo_client
        .put_item()
        .table_name("bandcamp-timeline_user")
        .item(
            "email",
            aws_sdk_dynamodb::model::AttributeValue::S(String::from(email)),
        )
        .item(
            "password_hash",
            aws_sdk_dynamodb::model::AttributeValue::S(String::from(hash)),
        )
        .send()
        .await
        .unwrap();
}
