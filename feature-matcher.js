const POPCOUNT=new Uint8Array(256);for(let i=0;i<256;i++){let n=i,count=0;while(n){n&=n-1;count++}POPCOUNT[i]=count}

export function artworkFeatures(source,{width=286,height=400,limit=700}={}){
  const cv=window.jsfeat;if(!cv)return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,width,height);
  const rgba=ctx.getImageData(0,0,width,height),gray=new cv.matrix_t(width,height,cv.U8_t|cv.C1_t);
  cv.imgproc.grayscale(rgba.data,width,height,gray);
  const corners=Array.from({length:width*height},()=>new cv.keypoint_t(0,0,0,0,0));
  cv.fast_corners.set_threshold(20);const count=cv.fast_corners.detect(gray,corners,16);
  const chosen=corners.slice(0,count).sort((a,b)=>b.score-a.score).slice(0,limit);
  for(const corner of chosen)corner.angle=0;
  const descriptors=new cv.matrix_t(32,chosen.length,cv.U8_t|cv.C1_t);cv.orb.describe(gray,chosen,chosen.length,descriptors);
  return{count:chosen.length,data:new Uint8Array(descriptors.data.slice(0,chosen.length*32))};
}

function hamming(a,ao,b,bo){let distance=0;for(let i=0;i<32;i++)distance+=POPCOUNT[a[ao+i]^b[bo+i]];return distance}
export function featureMatches(reference,query,ratio=.76){if(!reference?.count||!query?.count)return 0;let good=0;for(let i=0;i<reference.count;i++){let best=Infinity,runner=Infinity,offset=i*32;for(let j=0;j<query.count;j++){const distance=hamming(reference.data,offset,query.data,j*32);if(distance<best){runner=best;best=distance}else if(distance<runner)runner=distance}if(best<runner*ratio)good++}return good}
