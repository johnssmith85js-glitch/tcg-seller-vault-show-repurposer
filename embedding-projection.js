export const EMBEDDING_INPUT_DIM=1280;
export const EMBEDDING_DIM=96;
export const EMBEDDING_SEED=0x51f15e;

export function projectionMatrix(){
  let seed=EMBEDDING_SEED|0;
  const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
  const matrix=new Float32Array(EMBEDDING_INPUT_DIM*EMBEDDING_DIM),scale=1/Math.sqrt(EMBEDDING_DIM);
  for(let output=0;output<EMBEDDING_DIM;output++)for(let input=0;input<EMBEDDING_INPUT_DIM;input++)matrix[input*EMBEDDING_DIM+output]=(next()<.5?-1:1)*scale;
  return matrix;
}

export function quantizeProjected(values){
  const out=new Int8Array(EMBEDDING_DIM);let norm=0;
  for(let i=0;i<EMBEDDING_DIM;i++)norm+=values[i]*values[i];
  norm=Math.sqrt(norm)||1;
  for(let i=0;i<EMBEDDING_DIM;i++)out[i]=Math.max(-127,Math.min(127,Math.round(values[i]/norm*127)));
  return out;
}
