## GOAL

Make an invoice-making Hyperware app

## process_lib VFS bindings

src/vfs/mod.rs
```
use crate::Request;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod directory;
pub mod file;

pub use directory::*;
pub use file::*;

/// IPC body format for requests sent to vfs runtime module.
#[derive(Debug, Serialize, Deserialize)]
pub struct VfsRequest {
    /// path is always prepended by [`crate::PackageId`], the capabilities of the topmost folder are checked
    /// "/your-package:publisher.os/drive_folder/another_folder_or_file"
    pub path: String,
    pub action: VfsAction,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum VfsAction {
    CreateDrive,
    CreateDir,
    CreateDirAll,
    CreateFile,
    OpenFile { create: bool },
    CloseFile,
    Write,
    WriteAll,
    Append,
    SyncAll,
    Read,
    ReadDir,
    ReadToEnd,
    ReadExact { length: u64 },
    ReadToString,
    Seek(SeekFrom),
    RemoveFile,
    RemoveDir,
    RemoveDirAll,
    Rename { new_path: String },
    Metadata,
    AddZip,
    CopyFile { new_path: String },
    Len,
    SetLen(u64),
    Hash,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SeekFrom {
    Start(u64),
    End(i64),
    Current(i64),
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum FileType {
    File,
    Directory,
    Symlink,
    Other,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_type: FileType,
    pub len: u64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DirEntry {
    pub path: String,
    pub file_type: FileType,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum VfsResponse {
    Ok,
    Err(VfsError),
    Read,
    SeekFrom { new_offset: u64 },
    ReadDir(Vec<DirEntry>),
    ReadToString(String),
    Metadata(FileMetadata),
    Len(u64),
    Hash([u8; 32]),
}

#[derive(Clone, Debug, Error, Serialize, Deserialize)]
pub enum VfsError {
    #[error("no write capability for requested drive")]
    NoWriteCap,
    #[error("no read capability for requested drive")]
    NoReadCap,
    #[error("failed to generate capability for new drive")]
    AddCapFailed,
    #[error("request could not be deserialized to valid VfsRequest")]
    MalformedRequest,
    #[error("request type used requires a blob")]
    NoBlob,
    #[error("error parsing path: {path}: {error}")]
    ParseError { error: String, path: String },
    #[error("IO error: {0}")]
    IOError(String),
    #[error("non-file non-dir in zip")]
    UnzipError,
    /// Not actually issued by `vfs:distro:sys`, just this library
    #[error("SendError")]
    SendError(crate::SendErrorKind),
}

pub fn vfs_request<T>(path: T, action: VfsAction) -> Request
where
    T: Into<String>,
{
    Request::new().target(("our", "vfs", "distro", "sys")).body(
        serde_json::to_vec(&VfsRequest {
            path: path.into(),
            action,
        })
        .expect("failed to serialize VfsRequest"),
    )
}

/// Metadata of a path, returns file type and length.
pub fn metadata(path: &str, timeout: Option<u64>) -> Result<FileMetadata, VfsError> {
    let timeout = timeout.unwrap_or(5);

    let message = vfs_request(path, VfsAction::Metadata)
        .send_and_await_response(timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

    match parse_response(message.body())? {
        VfsResponse::Metadata(metadata) => Ok(metadata),
        VfsResponse::Err(e) => Err(e),
        _ => Err(VfsError::ParseError {
            error: "unexpected response".to_string(),
            path: path.to_string(),
        }),
    }
}

/// Removes a path, if it's either a directory or a file.
pub fn remove_path(path: &str, timeout: Option<u64>) -> Result<(), VfsError> {
    let meta = metadata(path, timeout)?;

    match meta.file_type {
        FileType::Directory => remove_dir(path, timeout),
        FileType::File => remove_file(path, timeout),
        _ => Err(VfsError::ParseError {
            error: "path is not a file or directory".to_string(),
            path: path.to_string(),
        }),
    }
}

pub fn parse_response(body: &[u8]) -> Result<VfsResponse, VfsError> {
    serde_json::from_slice::<VfsResponse>(body).map_err(|_| VfsError::MalformedRequest)
}
```

src/vfs/file.rs
```
use super::{
    parse_response, vfs_request, FileMetadata, SeekFrom, VfsAction, VfsError, VfsResponse,
};
use crate::{get_blob, PackageId};

/// VFS (Virtual File System) helper struct for a file.
/// Opening or creating a `File` will give you a `Result<File, VfsError>`.
/// You can call its impl functions to interact with it.
#[derive(serde::Deserialize, serde::Serialize)]
pub struct File {
    pub path: String,
    pub timeout: u64,
}

impl File {
    /// Create a new file-manager struct with the given path and timeout.
    pub fn new<T: Into<String>>(path: T, timeout: u64) -> Self {
        Self {
            path: path.into(),
            timeout,
        }
    }

    /// Reads the entire file, from start position.
    /// Returns a vector of bytes.
    pub fn read(&self) -> Result<Vec<u8>, VfsError> {
        let message = vfs_request(&self.path, VfsAction::Read)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Read => {
                let data = match get_blob() {
                    Some(bytes) => bytes.bytes,
                    None => {
                        return Err(VfsError::ParseError {
                            error: "no blob".to_string(),
                            path: self.path.clone(),
                        })
                    }
                };
                Ok(data)
            }
            VfsResponse::Err(e) => Err(e.into()),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Reads the entire file, from start position, into buffer.
    /// Returns the amount of bytes read.
    pub fn read_into(&self, buffer: &mut [u8]) -> Result<usize, VfsError> {
        let message = vfs_request(&self.path, VfsAction::Read)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Read => {
                let data = get_blob().unwrap_or_default().bytes;
                let len = std::cmp::min(data.len(), buffer.len());
                buffer[..len].copy_from_slice(&data[..len]);
                Ok(len)
            }
            VfsResponse::Err(e) => Err(e.into()),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Read into buffer from current cursor position
    /// Returns the amount of bytes read.
    pub fn read_at(&self, buffer: &mut [u8]) -> Result<usize, VfsError> {
        let length = buffer.len() as u64;

        let message = vfs_request(&self.path, VfsAction::ReadExact { length })
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Read => {
                let data = get_blob().unwrap_or_default().bytes;
                let len = std::cmp::min(data.len(), buffer.len());
                buffer[..len].copy_from_slice(&data[..len]);
                Ok(len)
            }
            VfsResponse::Err(e) => Err(e.into()),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Reads until end of file from current cursor position
    /// Returns a vector of bytes.
    pub fn read_to_end(&self) -> Result<Vec<u8>, VfsError> {
        let message = vfs_request(&self.path, VfsAction::ReadToEnd)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Read => Ok(get_blob().unwrap_or_default().bytes),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Reads until end of file from current cursor position, converts to String.
    /// Throws error if bytes aren't valid utf-8.
    /// Returns a vector of bytes.
    pub fn read_to_string(&self) -> Result<String, VfsError> {
        let message = vfs_request(&self.path, VfsAction::ReadToString)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::ReadToString(s) => Ok(s),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Write entire slice as the new file.
    /// Truncates anything that existed at path before.
    pub fn write(&self, buffer: &[u8]) -> Result<(), VfsError> {
        let message = vfs_request(&self.path, VfsAction::Write)
            .blob_bytes(buffer)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Ok => Ok(()),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Write buffer to file at current position, overwriting any existing data.
    pub fn write_all(&mut self, buffer: &[u8]) -> Result<(), VfsError> {
        let message = vfs_request(&self.path, VfsAction::WriteAll)
            .blob_bytes(buffer)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Ok => Ok(()),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Write buffer to the end position of file.
    pub fn append(&mut self, buffer: &[u8]) -> Result<(), VfsError> {
        let message = vfs_request(&self.path, VfsAction::Append)
            .blob_bytes(buffer)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Ok => Ok(()),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Seek file to position.
    /// Returns the new position.
    pub fn seek(&mut self, pos: SeekFrom) -> Result<u64, VfsError> {
        let message = vfs_request(&self.path, VfsAction::Seek(pos))
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::SeekFrom {
                new_offset: new_pos,
            } => Ok(new_pos),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Copies a file to path, returns a new File.
    pub fn copy(&mut self, path: &str) -> Result<File, VfsError> {
        let message = vfs_request(
            &self.path,
            VfsAction::CopyFile {
                new_path: path.to_string(),
            },
        )
        .send_and_await_response(self.timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Ok => Ok(File {
                path: path.to_string(),
                timeout: self.timeout,
            }),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Set file length, if given size > underlying file, fills it with 0s.
    pub fn set_len(&mut self, size: u64) -> Result<(), VfsError> {
        let message = vfs_request(&self.path, VfsAction::SetLen(size))
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Ok => Ok(()),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Metadata of a path, returns file type and length.
    pub fn metadata(&self) -> Result<FileMetadata, VfsError> {
        let message = vfs_request(&self.path, VfsAction::Metadata)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Metadata(metadata) => Ok(metadata),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }

    /// Syncs path file buffers to disk.
    pub fn sync_all(&self) -> Result<(), VfsError> {
        let message = vfs_request(&self.path, VfsAction::SyncAll)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::Ok => Ok(()),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }
}

impl Drop for File {
    fn drop(&mut self) {
        vfs_request(&self.path, VfsAction::CloseFile)
            .send()
            .unwrap();
    }
}

/// Creates a drive with path "/package_id/drive", gives you read and write caps.
/// Will only work on the same package_id as you're calling it from, unless you
/// have root capabilities.
pub fn create_drive(
    package_id: PackageId,
    drive: &str,
    timeout: Option<u64>,
) -> Result<String, VfsError> {
    let timeout = timeout.unwrap_or(5);
    let path = format!("/{}/{}", package_id, drive);

    let message = vfs_request(&path, VfsAction::CreateDrive)
        .send_and_await_response(timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

    match parse_response(message.body())? {
        VfsResponse::Ok => Ok(path),
        VfsResponse::Err(e) => Err(e),
        _ => Err(VfsError::ParseError {
            error: "unexpected response".to_string(),
            path,
        }),
    }
}

/// Opens a file at path, if no file at path, creates one if boolean create is true.
pub fn open_file(path: &str, create: bool, timeout: Option<u64>) -> Result<File, VfsError> {
    let timeout = timeout.unwrap_or(5);

    let message = vfs_request(path, VfsAction::OpenFile { create })
        .send_and_await_response(timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

    match parse_response(message.body())? {
        VfsResponse::Ok => Ok(File {
            path: path.to_string(),
            timeout,
        }),
        VfsResponse::Err(e) => Err(e),
        _ => Err(VfsError::ParseError {
            error: "unexpected response".to_string(),
            path: path.to_string(),
        }),
    }
}

/// Creates a file at path, if file found at path, truncates it to 0.
pub fn create_file(path: &str, timeout: Option<u64>) -> Result<File, VfsError> {
    let timeout = timeout.unwrap_or(5);

    let message = vfs_request(path, VfsAction::CreateFile)
        .send_and_await_response(timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

    match parse_response(message.body())? {
        VfsResponse::Ok => Ok(File {
            path: path.to_string(),
            timeout,
        }),
        VfsResponse::Err(e) => Err(e),
        _ => Err(VfsError::ParseError {
            error: "unexpected response".to_string(),
            path: path.to_string(),
        }),
    }
}

/// Removes a file at path, errors if path not found or path is not a file.
pub fn remove_file(path: &str, timeout: Option<u64>) -> Result<(), VfsError> {
    let timeout = timeout.unwrap_or(5);

    let message = vfs_request(path, VfsAction::RemoveFile)
        .send_and_await_response(timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

    match parse_response(message.body())? {
        VfsResponse::Ok => Ok(()),
        VfsResponse::Err(e) => Err(e.into()),
        _ => Err(VfsError::ParseError {
            error: "unexpected response".to_string(),
            path: path.to_string(),
        }),
    }
}
```

src/vfs/directory.rs
```
use super::{parse_response, vfs_request, DirEntry, FileType, VfsAction, VfsError, VfsResponse};

/// VFS (Virtual File System) helper struct for a directory.
/// Opening or creating a directory will give you a `Result<Directory>`.
/// You can call it's impl functions to interact with it.
pub struct Directory {
    pub path: String,
    pub timeout: u64,
}

impl Directory {
    /// Iterates through children of `Directory`, returning a vector of DirEntries.
    /// DirEntries contain the path and file type of each child.
    pub fn read(&self) -> Result<Vec<DirEntry>, VfsError> {
        let message = vfs_request(&self.path, VfsAction::ReadDir)
            .send_and_await_response(self.timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;

        match parse_response(message.body())? {
            VfsResponse::ReadDir(entries) => Ok(entries),
            VfsResponse::Err(e) => Err(e),
            _ => Err(VfsError::ParseError {
                error: "unexpected response".to_string(),
                path: self.path.clone(),
            }),
        }
    }
}

/// Opens or creates a `Directory` at path.
/// If trying to create an existing `Directory`, will just give you the path.
pub fn open_dir(path: &str, create: bool, timeout: Option<u64>) -> Result<Directory, VfsError> {
    let timeout = timeout.unwrap_or(5);
    if !create {
        let message = vfs_request(path, VfsAction::Metadata)
            .send_and_await_response(timeout)
            .unwrap()
            .map_err(|e| VfsError::SendError(e.kind))?;
        match parse_response(message.body())? {
            VfsResponse::Metadata(m) => {
                if m.file_type != FileType::Directory {
                    return Err(VfsError::IOError(
                        "entry at path is not a directory".to_string(),
                    ));
                }
            }
            VfsResponse::Err(e) => return Err(e),
            _ => {
                return Err(VfsError::ParseError {
                    error: "unexpected response".to_string(),
                    path: path.to_string(),
                })
            }
        }

        return Ok(Directory {
            path: path.to_string(),
            timeout,
        });
    }

    let message = vfs_request(path, VfsAction::CreateDirAll)
        .send_and_await_response(timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

    match parse_response(message.body())? {
        VfsResponse::Ok => Ok(Directory {
            path: path.to_string(),
            timeout,
        }),
        VfsResponse::Err(e) => Err(e),
        _ => Err(VfsError::ParseError {
            error: "unexpected response".to_string(),
            path: path.to_string(),
        }),
    }
}

/// Removes a dir at path, errors if path not found or path is not a `Directory`.
pub fn remove_dir(path: &str, timeout: Option<u64>) -> Result<(), VfsError> {
    let timeout = timeout.unwrap_or(5);

    let message = vfs_request(path, VfsAction::RemoveDir)
        .send_and_await_response(timeout)
        .unwrap()
        .map_err(|e| VfsError::SendError(e.kind))?;

    match parse_response(message.body())? {
        VfsResponse::Ok => Ok(()),
        VfsResponse::Err(e) => Err(e),
        _ => Err(VfsError::ParseError {
            error: "unexpected response".to_string(),
            path: path.to_string(),
        }),
    }
}
```

## GOAL

Make an invoice-making Hyperware app

## Instructions

Look carefully at instructions.txt and in the resources/ directory. In particular, note the example applications resources/example-apps/sign/ and resources/example-apps/id/ resources/example-apps/file-explorer

Expand instructions.txt into a detailed implementation plan. The implementor will be starting from this existing template that exists at skeleton-app/ and ui/

Note in particular that bindings for the UI will be generated when the app is built with `kit build --hyperapp`. As such, first design and implement the backend; from the backend, the interface will be generated; finally design and implement the frontend to consume the interface. Subsequent changes to the interface must follow this pattern as well: start in backend, generated interface, finish in frontend

Do NOT create the API. The API is machine generated. You create types that end up in the API by defining and using them in functions in the Rust backend "hyperapp"

Do NOT write code: just create a detailed IMPLEMENTATION_PLAN.md that will be used by the implementor. The implementor will have access to resources/ but will be working from IMPLEMENTATION_PLAN.md, so include all relevant context here; you can refer the implementor to resources/ but do not assume the implementor has read them unless you refer them there.
