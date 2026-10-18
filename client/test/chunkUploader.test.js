import test from 'node:test';
import assert from 'node:assert';
import { DEFAULT_CHUNK_SIZE } from '../src/utils/chunkUploader.js';

test('chunkUploader - DEFAULT_CHUNK_SIZE is set to optimal 512KB for proxy safety', () => {
  assert.strictEqual(DEFAULT_CHUNK_SIZE, 512 * 1024);
  assert.ok(DEFAULT_CHUNK_SIZE <= 1024 * 1024, 'Chunk size must not exceed 1MB to pass Nginx/reverse proxy limits');
  assert.ok(DEFAULT_CHUNK_SIZE >= 256 * 1024, 'Chunk size must be at least 256KB for throughput efficiency');
});

test('chunkUploader - chunk calculations match file boundaries', () => {
  const calculateChunks = (fileSize, chunkSize) => Math.max(1, Math.ceil(fileSize / chunkSize));

  // 10 MB file with 512 KB chunks = 20 chunks
  assert.strictEqual(calculateChunks(10 * 1024 * 1024, 512 * 1024), 20);

  // 1 MB file with 512 KB chunks = 2 chunks
  assert.strictEqual(calculateChunks(1024 * 1024, 512 * 1024), 2);

  // 0 byte file = 1 chunk
  assert.strictEqual(calculateChunks(0, 512 * 1024), 1);
});
