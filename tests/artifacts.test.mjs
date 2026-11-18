import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {COPY,LOCALES} from '../dist/i18n.js';

const root=new URL('../dist/',import.meta.url);
function shape(value,prefix=''){
 if(Array.isArray(value))return value.flatMap((child,index)=>shape(child,`${prefix}[${index}]`));
 if(value&&typeof value==='object')return Object.keys(value).sort().flatMap(key=>shape(value[key],`${prefix}.${key}`));
 assert.equal(typeof value,'string',prefix);assert.ok(value.trim(),`Empty translation at ${prefix}`);return [prefix];
}
test('Russian, English and Hebrew have every UI translation and exact requested item names',()=>{
 assert.deepEqual([...LOCALES].sort(),['en','he','ru']);
 const expected=shape(COPY.ru);
 for(const locale of LOCALES)assert.deepEqual(shape(COPY[locale]),expected,locale);
 assert.equal(COPY.ru.items[2].name,'Шмаль');assert.equal(COPY.en.items[2].name,'Weed');assert.equal(COPY.he.items[2].name,'גראס');
 for(const locale of LOCALES){assert.equal(COPY[locale].levels.length,3);assert.equal(COPY[locale].items.length,5);}
});
test('sprite sheets are valid PNGs and atlas rectangles stay inside the actual images',async()=>{
 const files=await readdir(new URL('assets/',root));
 const pairs=[['nathan-sprites-v2.png','nathan-atlas.json'],['enemy-sprites.png','enemy-atlas.json'],['nathan-throws.png','nathan-throws-atlas.json'],['nathan-crouch.png','nathan-crouch-atlas.json']];
 for(const [png,json] of pairs){
  assert.ok(files.includes(png));assert.ok(files.includes(json));
  const bytes=await readFile(new URL(`assets/${png}`,root));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  const atlas=JSON.parse(await readFile(new URL(`assets/${json}`,root),'utf8'));
  assert.equal(atlas.width,width,png);assert.equal(atlas.height,height,png);
  for(const [name,frame] of Object.entries(atlas.frames)){
   assert.ok(frame.x>=0&&frame.y>=0&&frame.w>0&&frame.h>0,`${png}:${name}`);
   assert.ok(frame.x+frame.w<=width&&frame.y+frame.h<=height,`${png}:${name} outside image`);
  }
 }
});
