import {validOfficeSeating} from './office-seating.js';
import {validCharacters} from './characters.js';
import {validManagementFeedback} from './management-feedback.js';
import { replayActions, applyAction, rulesFor } from './game/rules.js';

export const SCHEMA_VERSION = 6;
export const SAVE_KEY = 'ai-dev-story-save-v6';
export const MIGRATION_SAVE_KEYS = ['ai-dev-story-save-v5','ai-dev-story-save-v4','ai-dev-story-save-v3'];
export const MIGRATION_SAVE_KEY = MIGRATION_SAVE_KEYS[0];
export const LEGACY_SAVE_KEYS = ['ai-dev-story-save-v2', 'ai-dev-story-save-v1'];
export const LEGACY_SAVE_KEY = LEGACY_SAVE_KEYS[0];
const assert = (condition, field) => { if (!condition) throw new Error(`存档数据无效：${field}`); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function equal(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right,key) && equal(left[key],right[key]));
}
function validateSnapshot(snapshot, allowLegacy = false) {
  assert(record(snapshot), 'snapshot');
  const fields = ['schemaVersion','state','dayProgressMs','observedStoryEvents','feedbackResponses'];
  assert(fields.every(field=>Object.hasOwn(snapshot,field))&&Object.keys(snapshot).every(field=>[...fields,'characters','officeSeating','managementFeedback'].includes(field)), 'snapshot-fields');
  if(Object.hasOwn(snapshot,'characters'))assert(validCharacters(snapshot.characters),'characters');
  if ([1,2].includes(snapshot.schemaVersion)) throw new Error('这是自动研发之前的旧版存档。原存档可保留和导出，请明确开张新公司体验方案与自动研发。');
  const legacy=allowLegacy&&[3,4].includes(snapshot.schemaVersion);
  assert(snapshot.schemaVersion === SCHEMA_VERSION || legacy || allowLegacy&&snapshot.schemaVersion===5, 'schemaVersion');
  assert(Number.isFinite(snapshot.dayProgressMs) && snapshot.dayProgressMs >= 0, 'dayProgressMs');
  const observed = snapshot.observedStoryEvents;
  assert(Array.isArray(observed) && observed.length<=2048 && observed.every(id=>typeof id==='string' && id.length<=160) && new Set(observed).size===observed.length, 'observedStoryEvents');
  assert(record(snapshot.state) && typeof snapshot.state.paused==='boolean', 'state');
  // Reuse the sole economic reducer. The snapshot is a readable cache, not a
  // second source for scores, hires, bills, funding or the development stages.
  if(legacy)assert(Array.isArray(snapshot.state.acceptedActions)&&snapshot.state.acceptedActions.every(action=>action?.type!=='beginCampaign'),'legacy-campaign-history');
  const replayed = replayActions(snapshot.state.acceptedActions);
  if(Object.hasOwn(snapshot,'officeSeating'))assert(validOfficeSeating(snapshot.officeSeating,replayed),'officeSeating');
  assert(snapshot.dayProgressMs < rulesFor(replayed).secondsPerDay*1000,'dayProgressMs');
  // Restoring or blocking an external write can pause a company without an
  // economic action. A snapshot may never silently resume a paused replay.
  if (snapshot.state.paused) replayed.paused = true;
  const expected={...replayed};
  // Economic facts and post identities replay strictly. Historical wording is
  // presentation data: a later copy edit must not invalidate a career save.
  if(replayed.career){
    const posts=snapshot.state.career?.posts;
    const fields=['id','day','author','text','topic','replies'];
    assert(Array.isArray(posts)&&posts.length===replayed.career.posts.length,'career-posts');
    for(const [index,post]of posts.entries()){
      const actual=replayed.career.posts[index];
      assert(record(post)&&Object.keys(post).length===fields.length&&fields.every(key=>Object.hasOwn(post,key)),'career-post-fields');
      assert(post.id===actual.id&&post.day===actual.day&&post.topic===actual.topic,'career-post-source');
      assert(typeof post.author==='string'&&post.author.length<=80&&typeof post.text==='string'&&post.text.length<=2000&&Array.isArray(post.replies)&&post.replies.length<=8&&post.replies.every(text=>typeof text==='string'&&text.length<=1000),'career-post-copy');
    }
    expected.career={...replayed.career,posts};
    if(snapshot.state.career.study&&replayed.career.study){
      assert(typeof snapshot.state.career.study.label==='string'&&snapshot.state.career.study.label.length<=100,'career-study-label');
      expected.career.study={...replayed.career.study,label:snapshot.state.career.study.label};
    }
    // A restored task keeps its historical name when it finishes. Only that
    // bounded display string may differ: notice order, identity and outcomes
    // still compare with the replay below.
    expected.notices=replayed.notices.map((notice,index)=>{
      const saved=snapshot.state.notices?.[index];
      if(notice.type!=='study-complete'||saved?.type!==notice.type)return notice;
      assert(typeof saved.label==='string'&&saved.label.length<=100,'career-complete-label');
      return {...notice,label:saved.label};
    });
  }
  if(legacy){delete expected.campaignProfile;assert(replayed.campaignProfile==='classic168','legacy-profile');}
  if(snapshot.schemaVersion===3){delete expected.growthEnabled;delete expected.employeeExperience;assert(replayed.growthEnabled===false,'legacy-growth');}
  assert(equal(snapshot.state,expected), 'state-history');
  if(Object.hasOwn(snapshot,'managementFeedback'))assert(snapshot.schemaVersion===6&&validManagementFeedback(snapshot.managementFeedback,replayed),'managementFeedback');
  const owned = replayed.models.filter(model=>model.company==='player');
  assert(record(snapshot.feedbackResponses) && Object.entries(snapshot.feedbackResponses).every(([id,text])=>owned.some(model=>model.id===id) && typeof text==='string' && text.length<=2000), 'feedbackResponses');
  return replayed;
}
export function encodeSave(snapshot) {
  validateSnapshot(snapshot);
  const raw=JSON.stringify(snapshot);
  assert(raw.length<=2_000_000,'raw-size');
  return raw;
}
/** Validate before touching storage, then preserve the old primary before replacement.
 * This is optimistic conflict detection, not an atomic cross-tab transaction.
 * A failed write keeps the primary intact; a successful backup may remain even
 * when the following primary write is refused by the browser.
 */
export function commitImportedSave(storage, snapshot, {expectedRaw, backupKey}) {
  let raw;
  try {
    assert(typeof backupKey==='string'&&backupKey.length>0&&backupKey!==SAVE_KEY,'import-backup-key');
    assert(expectedRaw===null||typeof expectedRaw==='string','import-expected-save');
    raw=encodeSave(snapshot);
  } catch(error) {
    return {ok:false,error:'invalid',message:error.message};
  }
  try {
    const current=storage.getItem(SAVE_KEY);
    if(current!==expectedRaw)return {ok:false,error:'conflict',message:'另一个页面更改了这份存档，导入未覆盖现有进度。'};
    if(current!==null)storage.setItem(backupKey,current);
    storage.setItem(SAVE_KEY,raw);
    return {ok:true,raw};
  } catch {
    return {ok:false,error:'storage',message:'导入未完成：浏览器无法保存，原存档未被替换，请保留原文件。'};
  }
}
export function decodeSave(raw) {
  try {
    assert(typeof raw==='string' && raw.length<=2_000_000,'raw');
    let snapshot=JSON.parse(raw);
    const replayed=validateSnapshot(snapshot,true);
    const migratedFrom=snapshot.schemaVersion===SCHEMA_VERSION?null:snapshot.schemaVersion;
    if(migratedFrom){
      let migrated=replayed;
      if(migratedFrom<5&&!replayed.growthEnabled&&!replayed.ending){const result=applyAction(replayed,{type:'enableGrowth'});assert(result.ok,'growth-migration');migrated=result.state;}
      // Validation above has already checked every post's identity and bounded
      // its copy. Migrate the economic replay without rewriting that history.
      if(migrated.career&&snapshot.state.career){
        migrated.career={...migrated.career,posts:snapshot.state.career.posts};
        if(migrated.career.study&&snapshot.state.career.study)migrated.career.study={...migrated.career.study,label:snapshot.state.career.study.label};
        migrated.notices=migrated.notices.map((notice,index)=>notice.type==='study-complete'?{...notice,label:snapshot.state.notices[index].label}:notice);
      }
      snapshot={...snapshot,schemaVersion:SCHEMA_VERSION,state:migrated};
    }
    snapshot.state.paused=true;
    return migratedFrom?{ok:true,snapshot,migratedFrom}:{ok:true,snapshot};
  } catch(error) {
    return {ok:false,error:error instanceof SyntaxError?'存档无法解析，请保留原存档或明确选择重新开始。':error.message};
  }
}
