#!/bin/bash
BOOTSTRAP_NAME="bootstrap"
ZIP_NAME="lambda.zip"
PACKAGE_NAME="mailparser"

rm "./${BOOTSTRAP_NAME}"
rm "./${ZIP_NAME}"
# https://github.com/awslabs/aws-sdk-rust/issues/186#issuecomment-898442351
export CC_x86_64_unknown_linux_musl=x86_64-linux-musl-gcc
ln -s /usr/local/opt/musl-cross/bin/x86_64-linux-musl-gcc /usr/local/bin/musl-gcc
cargo build --release --target x86_64-unknown-linux-musl
cp target/x86_64-unknown-linux-musl/release/${PACKAGE_NAME} "./${BOOTSTRAP_NAME}"
zip ${ZIP_NAME} ${BOOTSTRAP_NAME}