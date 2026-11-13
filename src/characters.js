// Cosmetic company metadata, separate from the strictly replayed economy.
export const DEFAULT_CHARACTERS=Object.freeze({boss:'male',secretary:'female'});
export const GENDERS=Object.freeze(['male','female']);
export function validCharacters(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&['boss','secretary'].every(role=>Object.hasOwn(value,role)&&GENDERS.includes(value[role]));}
export function charactersOrDefault(value){return validCharacters(value)?{...value}:{...DEFAULT_CHARACTERS};}
export function leadershipSprite(role,characters=DEFAULT_CHARACTERS){
  const selection=charactersOrDefault(characters);
  if(role==='boss')return selection.boss==='female'?{sheet:'leadership',cell:0}:{sheet:'seated',cell:9};
  if(role==='secretary')return selection.secretary==='male'?{sheet:'leadership',cell:1}:{sheet:'seated',cell:10};
  throw new Error('Unknown leadership role');
}
export const genderLabel=gender=>gender==='female'?'女':'男';
