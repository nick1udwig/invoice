wit_bindgen::generate!({
    path: "target/wit",
    world: "types",
    generate_unused_types: true,
    additional_derives: [serde::Deserialize, serde::Serialize, process_macros::SerdeJsonInto],
});

/// Generated caller utilities for RPC function stubs

pub use hyperware_app_common::AppSendError;
pub use hyperware_app_common::send;
use hyperware_app_common::hyperware_process_lib as hyperware_process_lib;
use hyperware_process_lib::{Address, Request};
use serde_json::json;

// Import types from each interface
pub use crate::hyperware::process::standard::*;
pub use crate::hyperware::process::sign::*;
pub use crate::hyperware::process::id::*;

/// Generated RPC stubs for the id interface
pub mod id {
    use crate::*;

    // /// Generated stub for `sign` http RPC call
    // /// HTTP endpoint - uncomment to implement
    // pub async fn sign_http_rpc(_target: &str, _message:  Vec<u8>) -> Result<Result<Vec<u8>, String>, AppSendError> {
    //     // TODO: Implement HTTP endpoint
    //     Ok(Ok(Vec::new()))
    // }
    
    // /// Generated stub for `verify` http RPC call
    // /// HTTP endpoint - uncomment to implement
    // pub async fn verify_http_rpc(_target: &str, _message:  Vec<u8>, _signature:  Vec<u8>) -> Result<Result<bool, String>, AppSendError> {
    //     // TODO: Implement HTTP endpoint
    //     Ok(Ok(false))
    // }
    
    
}

/// Generated RPC stubs for the sign interface
pub mod sign {
    use crate::*;

    /// Generated stub for `sign` local RPC call
    pub async fn sign_local_rpc(target: &Address, message: Vec<u8>) -> Result<Result<Vec<u8>, String>, AppSendError> {
        let body = json!({"Sign": message});
        let body = serde_json::to_vec(&body).unwrap();
        let request = Request::to(target)
            .body(body);
        send::<Result<Vec<u8>, String>>(request).await
    }
    
    /// Generated stub for `verify` local RPC call
    pub async fn verify_local_rpc(target: &Address, message: Vec<u8>, signature: Vec<u8>) -> Result<Result<bool, String>, AppSendError> {
        let body = json!({"Verify": (message, signature)});
        let body = serde_json::to_vec(&body).unwrap();
        let request = Request::to(target)
            .body(body);
        send::<Result<bool, String>>(request).await
    }
    
    
}

