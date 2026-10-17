import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_CHUNK_SIZE } from '../src/utils/chunkUploader.js';

test('chunkUploader - DEFAULT_CHUNK_SIZE is set to optimal 1.5MB', () => {
  assert.strictEqual(DEFAULT_CHUNK_SIZE, 1.5 * 1024 * 1024);
  assert.ok(DEFAULT_CHUNK_SIZE > 1000000, 'Chunk size must exceed 1MB for upload throughput efficiency');
  assert.ok(DEFAULT_CHUNK_SIZE <= 5000000, 'Chunk size must be under 5MB to prevent network timeouts');
});

test('chunkUploader - chunk calculations match file boundaries', () => {
  const calculateChunks = (fileSize, chunkSize) => Math.max(1, Math.ceil(fileSize / chunkSize));

  // 10 MB file with 1.5 MB chunks = 7 chunks
  assert.strictEqual(calculateChunks(10 * 1024 * 1024, 1.5 * 1024 * 1024), 7);

  // 1 MB file with 1.5 MB chunks = 1 chunk
  assert.strictEqual(calculateChunks(1024 * 1024, 1.5 * 1024 * 1024), 1);

  // 0 byte file = 1 chunk
  assert.strictEqual(calculateChunks(0, 1.5 * 1024 * 1024), 1);
});
