export function differenceHash(gray,width=9,height=8){
  if(gray.length<width*height)throw new Error('Artwork fingerprint input is incomplete.');
  let bits=0n,bit=0n;
  for(let y=0;y<height;y++)for(let x=0;x<width-1;x++,bit++)if(gray[y*width+x]>=gray[y*width+x+1])bits|=1n<<bit;
  return bits.toString(16).padStart(16,'0');
}

export function hashDistance(a,b){
  let value=BigInt(`0x${a}`)^BigInt(`0x${b}`),count=0;
  while(value){value&=value-1n;count++}
  return count;
}

export function hashBands(hash){
  return Array.from({length:8},(_,index)=>hash.slice(index*2,index*2+2));
}
