import test from'node:test';
import assert from'node:assert/strict';
import{EMBEDDING_DIM,EMBEDDING_INPUT_DIM,projectionMatrix,quantizeProjected}from'../embedding-projection.js';

test('artwork projection is deterministic and correctly shaped',()=>{
  const first=projectionMatrix(),second=projectionMatrix();
  assert.equal(first.length,EMBEDDING_INPUT_DIM*EMBEDDING_DIM);
  assert.deepEqual(first,second);
});

test('projected artwork vectors are normalized into signed bytes',()=>{
  const input=Float32Array.from({length:EMBEDDING_DIM},(_,index)=>index-40);
  const output=quantizeProjected(input);
  assert.equal(output.length,EMBEDDING_DIM);
  assert.ok([...output].every(value=>value>=-127&&value<=127));
  assert.ok(output.some(value=>value<0)&&output.some(value=>value>0));
});
