import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoDetectFoundCamera } from './CameraService.js';

const HEADER = 'Model                          Port                                            \n';
const DASHES = '----------------------------------------------------------\n';

test('empty output: no camera', () => {
  assert.equal(autoDetectFoundCamera(''), false);
});

test('header only, no dashed line: no camera', () => {
  assert.equal(autoDetectFoundCamera(HEADER), false);
});

test('header + dashed line (empty table, exit 0): no camera', () => {
  assert.equal(autoDetectFoundCamera(HEADER + DASHES), false);
  assert.equal(autoDetectFoundCamera(HEADER + DASHES + '\n\n'), false);
});

test('one usb row: camera found', () => {
  const row = 'Sony Alpha-A7 IV (PC Control)  usb:001,005                                     \n';
  assert.equal(autoDetectFoundCamera(HEADER + DASHES + row), true);
  assert.equal(autoDetectFoundCamera(HEADER + DASHES + row + '\n'), true);
});
