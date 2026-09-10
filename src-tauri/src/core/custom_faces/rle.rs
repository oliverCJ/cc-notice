use thiserror::Error;

const MAX_RUN_LENGTH: usize = 128;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum RleError {
    #[error("custom face RLE literal is truncated")]
    TruncatedLiteral,
    #[error("custom face RLE output length is {actual}, expected {expected}")]
    OutputSizeMismatch { expected: usize, actual: usize },
}

pub fn encode_rle(source: &[u8]) -> Vec<u8> {
    let mut output = Vec::new();
    let mut index = 0;
    while index < source.len() {
        if source[index] == 0 {
            let length = source[index..]
                .iter()
                .take(MAX_RUN_LENGTH)
                .take_while(|value| **value == 0)
                .count();
            output.push((length - 1) as u8);
            index += length;
        } else {
            let length = source[index..]
                .iter()
                .take(MAX_RUN_LENGTH)
                .take_while(|value| **value != 0)
                .count();
            output.push(0x80 | (length - 1) as u8);
            output.extend_from_slice(&source[index..index + length]);
            index += length;
        }
    }
    output
}

pub fn decode_rle(encoded: &[u8], expected_size: usize) -> Result<Vec<u8>, RleError> {
    let mut output = Vec::with_capacity(expected_size);
    let mut index = 0;
    while index < encoded.len() {
        let token = encoded[index];
        index += 1;
        let length = usize::from(token & 0x7f) + 1;
        let next_size = output.len().checked_add(length).unwrap_or(usize::MAX);
        if next_size > expected_size {
            return Err(RleError::OutputSizeMismatch {
                expected: expected_size,
                actual: next_size,
            });
        }
        if token & 0x80 == 0 {
            output.resize(next_size, 0);
            continue;
        }
        let literal_end = index.checked_add(length).unwrap_or(usize::MAX);
        if literal_end > encoded.len() {
            return Err(RleError::TruncatedLiteral);
        }
        output.extend_from_slice(&encoded[index..literal_end]);
        index = literal_end;
    }

    if output.len() != expected_size {
        return Err(RleError::OutputSizeMismatch {
            expected: expected_size,
            actual: output.len(),
        });
    }
    Ok(output)
}
