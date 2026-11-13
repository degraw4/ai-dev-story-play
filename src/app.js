import {actionError} from './action-errors.js';
import {dismissalImpact} from './employment-feedback.js';
import {createManagementFeedback,captureManagementFeedback,cashflowSignal} from './management-feedback.js';
import {createManagementFeedbackUI} from './management-feedback-ui.js';
import {renderModelHistory} from './history-ui.js';
import {officeSeatAssignments} from './office-seating.js';
import {createOfficeSeatingUI} from './office-seating-ui.js';
import {createCharacterUI} from './character-ui.js';
import {charactersOrDefault} from './characters.js';
import { createCareerUI } from './career-ui.js';
import { isCareer, projectStages } from './game/career.js';
import { RULES, DIRECTIONS, EMPLOYEES, STAGES } from './game/content.js';
import {isNextCareer, pendingProjectDecision, unresolvedIssues, supportCost} from './game/career-next.js';
import {careerSubscription} from './game/career.js';
import { createState, applyAction, canWaitForPlanner, board, rank, total, price, productionSummary, employeeActivity, employeeAbilities, publicationPresenter, proposalScores, usedCompute, recruitmentStatus, rulesFor, marketSummary, employeeTerms, trainingCost, mediaCost, operatingCosts, mediaCampaign, quotaResetStatus, baseSubscriptionIncome } from './game/rules.js';
import { advanceClock } from './clock.js';
import { onboardingStep, tourStep, updateTourProgress } from './onboarding.js';
import { SCHEMA_VERSION, SAVE_KEY, MIGRATION_SAVE_KEYS, LEGACY_SAVE_KEYS, encodeSave, decodeSave, commitImportedSave } from './storage.js';
import { unreadNotifications } from './notifications.js';
import { storyScene, reachedStoryScenes, storyStartMarker, careerStoryStartMarker, versionNotesStartMarker, selectedStoryChoice } from './story-scenes.js';
import { createAudioController } from './audio.js';
import { createOfficeRenderer } from './office.js';
import { createDirectionIcon } from './point-icons.js';
import { createResearchFeedback } from './research-feedback.js';
import { developmentProgress } from './development-progress.js';
import { drawPlanning, drawRelease, drawCelebration } from './stage-art.js';
import {createCharacterPortrait} from './character-art.js';
import { DIRECTION_LABELS, EMPLOYEE_TRAITS, FAREWELLS, finaleDay, chapterAt, newsFor, mediaHeadline, playerReleaseCopy, userFeedback, rivalCopy, ENDING_COPY, modelIntroduction, specialAbility } from './story.js';

const $ = id => document.getElementById(id);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const clear = id => { const node = typeof id === 'string' ? $(id) : id; node.replaceChildren(); return node; };
const option = (value,text) => { const node = element('option',text); node.value = value; return node; };
const money = value => `${value} 万`;
const ratingLabel = company => company.models.some(model=>model.company==='player')?`${(company.ratingTenths/10).toFixed(1)} / 5`:'暂无评价';
const SETTINGS_KEY = 'ai-dev-story-settings-v1';
let settings = { companyName:'明日智能', music:35, effects:60, speed:1, sound:false, guideSkipped:false, tourStep:0, tourCompleted:true, awardScenes:true };
try { const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)); if (saved && typeof saved === 'object') { if (typeof saved.companyName === 'string') settings.companyName = saved.companyName.slice(0,30); for (const key of ['music','effects']) if (Number.isFinite(saved[key])) settings[key] = Math.max(0,Math.min(100,saved[key])); if ([1,2,4].includes(saved.speed)) settings.speed=saved.speed; if (typeof saved.sound === 'boolean') settings.sound = saved.sound; if(typeof saved.awardScenes==='boolean')settings.awardScenes=saved.awardScenes; if (typeof saved.guideSkipped === 'boolean') settings.guideSkipped=saved.guideSkipped; if(Number.isInteger(saved.tourStep))settings.tourStep=Math.max(0,Math.min(4,saved.tourStep)); if(typeof saved.tourCompleted==='boolean')settings.tourCompleted=saved.tourCompleted; } } catch {}
let state = createState();
let dayProgressMs = 0;
let observedStoryEvents = [];
let feedbackResponses = {};
let started = false;
let officeSeating={};
let managementFeedback=null;
let characters=charactersOrDefault(),creatingCompany=false,newGameOverwrite=false,returnToEnding=false;
let writeBlocked = false;
let storageWriteFailed = false;
let lastKnownRaw = null;
let storageProblem = '';
let closingTab = false;
let presentationTimers = [];
let presentationCue = null;
let reportShown = false;
let lastFrame = performance.now();
let lastFractionSave = lastFrame;
let confirmAction = null;
let lastSuggestedName = '';
let tourActive = false;
let planningRevealTimer = null;
let activeMilestone = null;
let lastPlanFrame = -1;
let tooltipAnchor = null;
let tooltipPinned = false;
let resumeAfterInterruption = false;
let resumeQueued = false;
let activeNotification = null;
let activeStory = null;
const audio = createAudioController();
audio.setMusicVolume(settings.music / 100);
audio.setEffectsVolume(settings.effects / 100);
const office = createOfficeRenderer($('office'));
const characterUI=createCharacterUI();
const seatingUI=createOfficeSeatingUI({getState:()=>state,getSeating:()=>officeSeating,office,canvas:$('office'),isLocked:()=>!started||writeBlocked||!!state.ending,commit:next=>{
  if(writeBlocked||state.ending)return false;const previous=officeSeating;officeSeating=next;
  if(!save()){officeSeating=previous;render();showMessage('工位未保存，请检查存档状态后重试。',true);return false;}
  render();safeSound('ui');showMessage('工位已调整并保存。');return true;
}});
const researchFeedback=createResearchFeedback();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)flushResearchFeedback();});

const managementUI=createManagementFeedbackUI({getState:()=>state,getRecord:()=>managementFeedback,setRecord:record=>managementFeedback=record,confirm:showConfirm,pause:pauseForReading,save,savePause:()=>{resumeAfterInterruption=false;if(!state.paused)act({type:'pause'});return save();},openPanel,sound:safeSound,schedule:scheduleAutomaticResume,getSettings:()=>settings});
managementUI.setDispatch(action=>act(action,'ui'));

const careerUI=createCareerUI({getFeedback:()=>managementFeedback,requestImpact:managementUI.request,phaseCard:managementUI.phaseCard,getState:()=>state,dispatch:action=>act(action,'ui'),confirm:showConfirm,getNews:()=>newsFor(state),flushFeedback:flushResearchFeedback,savePause:()=>{resumeAfterInterruption=false;if(!state.paused)act({type:'pause'});const success=save();showMessage(success?'已存档并暂停。':'保存失败，当前保持暂停；请导出存档保留进度。',!success);return success;},onDecision:action=>{if(act(action,'ui')){resumeAfterInterruption=true;scheduleAutomaticResume();}}});

function snapshot() { return { schemaVersion:SCHEMA_VERSION, state, dayProgressMs, observedStoryEvents, feedbackResponses, characters, managementFeedback:managementFeedback??createManagementFeedback(state), officeSeating:officeSeatAssignments(state,officeSeating) }; }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); } catch {} }
function showMessage(text,error=false) {
  $('action-message').textContent=text; $('action-message').classList.toggle('error',error);
  const panelMessage=document.querySelector('.management-panel[open] .panel-message');
  if(panelMessage){panelMessage.textContent=text;panelMessage.hidden=false;panelMessage.classList.toggle('error',error);}
}
function displayStorageProblem() {
  $('save-alert').hidden = !storageProblem;
  $('save-alert-text').textContent = storageProblem;
  $('reload-save').hidden = !writeBlocked;
  $('discard-save').hidden = !writeBlocked;
  const retryable=storageWriteFailed&&!writeBlocked;
  $('settings-storage-alert').hidden = !writeBlocked&&!storageWriteFailed;
  $('settings-storage-title').textContent = retryable?'保存失败 · 本页保持暂停':started?'存档冲突 · 本页保持暂停':'存档暂不可用';
  $('settings-storage-copy').textContent = storageProblem;
  $('settings-storage-help').textContent = retryable?'最新操作仍在本页内存中，请先导出当前进度，避免刷新丢失。重试保存只写入现有进度，不重复执行操作或扣费。':started?'可先导出下方的本页进度，再载入浏览器中已保存的公司。导出不会覆盖另一页的存档。':'原存档内容仍保留；可重新载入检查，或导入有效备份。只有明确确认新局或导入时才会替换原内容。';
  $('settings-retry-save').hidden = !retryable;
  $('settings-reload-save').hidden = retryable;
  $('export-current-save').disabled = !started;
  const saveControl=$('settings-dialog').querySelector('.save-pause');if(saveControl){saveControl.disabled=writeBlocked||!started;saveControl.hidden=retryable;}
}
function blockConflictingSave() {
  resumeAfterInterruption=false;
  writeBlocked=true;
  state={...state,paused:true};
  storageProblem='另一个页面更改了这份存档。本页已暂停，不会覆盖对方进度。请重新载入最新存档。';
  $('save-status').textContent='存档已变化，本页暂停';
  audio.setBackgrounded(true);
  displayStorageProblem();
  render();
  showStorageRecovery();
}
function save(explicitOverwrite=false) {
  if (!started || writeBlocked) return false;
  try {
    const raw=encodeSave(snapshot());
    if (!explicitOverwrite && localStorage.getItem(SAVE_KEY)!==lastKnownRaw) { blockConflictingSave(); return false; }
    localStorage.setItem(SAVE_KEY,raw);
    lastKnownRaw=raw;
    $('save-status').textContent='已保存到此浏览器'; storageProblem='';storageWriteFailed=false; displayStorageProblem(); return true;
  }
  catch {
    storageWriteFailed=true;resumeAfterInterruption=false;state={...state,paused:true};
    $('save-status').textContent='保存失败，经营已暂停';storageProblem='保存失败：浏览器未能写入存档，经营保持暂停。请保留页面，并在声音与存档中导出当前进度。';
    displayStorageProblem();renderTimeButton();
    // Finish the accepted action's render/presentation before opening recovery.
    // Its in-memory result is retained; retrying must never apply it again.
    queueMicrotask(()=>{if(storageWriteFailed)showStorageRecovery();});
    return false;
  }
}
function restoreBeforeConflict(before, progress, observed, feedback=managementFeedback) {
  managementFeedback=feedback;
  state={...before,paused:true}; dayProgressMs=progress; observedStoryEvents=observed;
  render(); showMessage('存档已被其他页面修改，本次操作没有保存。请重新载入最新进度。',true);
}
function restore() {
  let raw,migrating=false;
  try { raw = localStorage.getItem(SAVE_KEY); lastKnownRaw=raw;if(!raw){for(const key of MIGRATION_SAVE_KEYS){const previous=localStorage.getItem(key);if(previous){raw=previous;migrating=true;break;}}} } catch { storageProblem='无法读取浏览器存档。当前可以开始新局，但存档功能可能不可用。'; displayStorageProblem(); return {loaded:false}; }
  if (!raw) {
    try { const slots=LEGACY_SAVE_KEYS.filter(key=>localStorage.getItem(key)!==null);$('legacy-save-notice').hidden=!slots.length;const select=clear('legacy-save-slot');for(const key of slots)select.append(option(key,key.endsWith('v2')?'手动研发三方向存档':'五方向存档')); } catch {}
    return {loaded:false};
  }
  const decoded = decodeSave(raw);
  if (!decoded.ok) { writeBlocked=true; storageProblem='已有存档无法读取，原内容已保留。请重新载入检查，或明确开始新局后替换。'; displayStorageProblem(); return {loaded:false}; }
  ({state,dayProgressMs,observedStoryEvents,feedbackResponses} = decoded.snapshot);
  storageWriteFailed=false;
  officeSeating=officeSeatAssignments(state,decoded.snapshot.officeSeating);
  managementFeedback=decoded.snapshot.managementFeedback??createManagementFeedback(state);
  characters=charactersOrDefault(decoded.snapshot.characters);characterUI.syncForm(characters);
  started=true;
  const enableNewBurst=state.campaignProfile==='budget112'&&!state.burstEnabled&&!state.ending;
  if(enableNewBurst){const enabled=applyAction(state,{type:'enableBurst'});if(enabled.ok)state=enabled.state;}
  const enableSubscriptions=!!rulesFor(state).trainingBase&&!state.subscriptionGrowthEnabled&&!state.ending;
  if(enableSubscriptions){const enabled=applyAction(state,{type:'enableSubscriptionGrowth'});if(enabled.ok)state=enabled.state;}
  const initializeStories=!observedStoryEvents.some(id=>/^story-start:\d+$/.test(id));
  if(initializeStories)observedStoryEvents.push(storyStartMarker(state.gameDay+1));
  const initializeCareerStories=!observedStoryEvents.some(id=>/^story-career-v1-start:\d+$/.test(id));
  if(initializeCareerStories)observedStoryEvents.push(careerStoryStartMarker(state.gameDay+1));
  const initializeVersionNotes=!observedStoryEvents.some(id=>/^story-version-notes-start:\d+$/.test(id));
  if(initializeVersionNotes)observedStoryEvents.push(versionNotesStartMarker(state.gameDay+1));
  const persisted=!(initializeStories||initializeCareerStories||initializeVersionNotes||enableNewBurst||enableSubscriptions||migrating)||save();
  if(persisted){
    $('save-status').textContent='存档已恢复，时间暂停';
    if(migrating)showMessage('已有公司按原日历接续，旧进度原文已保留。新公司采用当前经营规则。');
    if(enableNewBurst)showMessage('员工火爆已加入后续研发，下一款模型开始自动触发；当前项目保留原进度。');
    if(enableSubscriptions)showMessage('后续账单已采用新的订阅档位：拿到综合榜首融资后，跌出第一仍能保留较高订阅收入。已有资金和账单保留。');
  }
  return {loaded:true,persisted};
}
function safeSound(name) { if(name==='stop-award')audio.stop('award');else audio.play(name); }
function observeNews(before) {
  for(const news of newsFor(state).filter(item=>item.id.startsWith('chapter-')))if(!observedStoryEvents.includes(news.id))observedStoryEvents.push(news.id);
  return state.gameDay>before.gameDay&&unreadNotifications(state,observedStoryEvents).some(item=>item.kind==='news'&&item.day>before.gameDay);
}
function effectsFor(before, publication = false) {
  if(isCareer(state)&&((pendingProjectDecision(state)&&!pendingProjectDecision(before))||state.career.assessment&&!before.career?.assessment)){flushResearchFeedback();safeSound('news');}
  if(before.career?.study&&!state.career?.study&&state.notices.slice(before.notices.length).some(n=>n.type==='study-complete'))safeSound('researchReady');
  if(before.project?.id===state.project?.id&&before.project?.experiment?.success==null&&typeof state.project?.experiment?.success==='boolean')safeSound(state.project.experiment.success?'researchReady':'error');
  if (before.project?.id === state.project?.id && before.project?.status !== 'ready' && state.project?.status === 'ready') { safeSound('researchReady'); showMessage(isNextCareer(state)?'普通评测完成，已暂停。查看上线问题后决定发布时间。':'研发完成，模型待发布。经营继续，准备好后召开发布会。');if(!isNextCareer(state)&&!before.paused&&!state.ending){resumeAfterInterruption=true;scheduleAutomaticResume();} }
  if (!publication && state.funding.length > before.funding.length) safeSound('funding');
  if (state.ratingTenths > before.ratingTenths) safeSound('reset');
  const oldRank=rank(before),newRank=rank(state);
  if (!publication && oldRank !== null && newRank !== null && oldRank !== newRank) safeSound(newRank<oldRank?'rankUp':'rankDown');
  if (!before.ending && state.ending) { safeSound(state.cash<0?'bankrupt':'ending'); showEnding(); }
}
function act(action, sound, message) {
  for(const node of document.querySelectorAll('.panel-message')){node.textContent='';node.hidden=true;}
  if (writeBlocked) { showMessage('另一个页面或无法读取的存档需要先处理，当前经营已暂停。',true); safeSound('error'); return null; }
  if(storageWriteFailed){showStorageRecovery();return null;}
  const before=state, beforeProgress=dayProgressMs, beforeObserved=[...observedStoryEvents], beforeFeedback=managementFeedback;
  const result=applyAction(state,action);
  if (!result.ok) { showMessage(actionError(result.error),true); safeSound('error'); render(); return null; }
  state=result.state;
  managementFeedback=captureManagementFeedback(managementFeedback,before,state,action);
  if(isNextCareer(state))showMessage('');
  if(action.type==='resume'){resumeAfterInterruption=false;showMessage('');}
  const hasNews=observeNews(before);
  // Saving precedes every presentation. Closing or replaying a scene never reapplies this action.
  save();
  if(writeBlocked){restoreBeforeConflict(before,beforeProgress,beforeObserved,beforeFeedback);return null;}
  researchFeedback.sync(state,result.presentationEvents,rulesFor(state).secondsPerDay*1000/settings.speed);
  if(reducedMotion.matches)researchFeedback.flush();
  render();
  if(hasNews)safeSound('news');
  if (sound) safeSound(sound);
  if (message) showMessage(message);
  effectsFor(before,action.type==='publish');
  scheduleAutomaticResume();
  return {before,after:state};
}
function pauseForReading() {
  flushResearchFeedback();
  if(started&&!state.paused&&!state.ending){resumeAfterInterruption=true;act({type:'pause'});}
  lastFrame=performance.now();
}
function scheduleAutomaticResume(){
  if(resumeQueued)return;
  resumeQueued=true;
  setTimeout(()=>{
    resumeQueued=false;
    if(!started||creatingCompany||state.ending||writeBlocked||storageWriteFailed||document.hidden||closingTab||tourActive||document.querySelector('dialog[open]')||!$('release-scene').hidden||!$('ending-scene').hidden||!$('planning-scene').hidden)return;
    if(researchFeedback.pending)return;
    if(managementUI.maybeCelebrate())return;
    if(showNextNotification())return;
    if(!resumeAfterInterruption)return;
    if(state.project?.status==='planning'&&state.project.plannerId===null&&!canWaitForPlanner(state))return;
    if(isCareer(state)&&(state.career.assessment||pendingProjectDecision(state)))return;
    resumeAfterInterruption=false;
    if(state.paused)act({type:'resume'});
    lastFrame=performance.now();
  },0);
}
function toggleTime(){
  if(state.project?.status==='ready'&&state.paused&&researchFeedback.pending){
    resumeAfterInterruption=!resumeAfterInterruption;render();safeSound('ui');lastFrame=performance.now();return;
  }
  resumeAfterInterruption=false;
  act({type:state.paused?'resume':'pause'},'ui');lastFrame=performance.now();
}
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',scheduleAutomaticResume);
function showConfirm(title,copy,action,{danger=false,confirmLabel='确认安排'}={}) { pauseForReading(); closeDialogs(); $('confirm-accept').classList.toggle('danger',danger);$('confirm-accept').classList.toggle('primary',!danger);$('confirm-accept').textContent=confirmLabel; $('confirm-title').textContent=title; if(typeof copy==='string')$('confirm-copy').textContent=copy;else $('confirm-copy').replaceChildren(copy); confirmAction=action; $('confirm-dialog').showModal(); }
function newGameConfirmed(explicitOverwrite=false) {
  careerUI.resetDecisionDraft();
  officeSeating={};characters=characterUI.readForm();creatingCompany=false;newGameOverwrite=false;returnToEnding=false;$('cancel-new-game').hidden=true;
  resumeAfterInterruption=false;
  activeNotification=null;activeStory=null;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  stopPresentation(); stopPresentationAudio(); closePlanning(); activeMilestone=null; $('event-dialog').close(); $('release-scene').hidden=true; $('ending-scene').hidden=true; setPresentationInert(false);
  writeBlocked=false;storageWriteFailed=false; storageProblem=''; displayStorageProblem();
  audio.setBackgrounded(document.hidden);
  state=createState({profile:$('company-profile').value}); managementFeedback=createManagementFeedback(state); dayProgressMs=0; observedStoryEvents=[storyStartMarker(0),careerStoryStartMarker(0),versionNotesStartMarker(0)]; feedbackResponses={}; started=true;
  settings.guideSkipped=false;
  Object.assign(settings,updateTourProgress(settings,'restart'));
  settings.companyName=$('company-name').value.trim().slice(0,30)||settings.companyName||'明日智能';
  saveSettings(); observeNews(state); save(explicitOverwrite); render();
  if(writeBlocked){showMessage('已有进度发生变化，请重新载入或明确确认替换存档。',true);return;}
  showMessage('公司开张！先跟小满认识办公室，再开始第一款模型。');
  showTour();
}
function requestNewGame() {
  pauseForReading();closeDialogs();creatingCompany=true;newGameOverwrite=true;
  returnToEnding=!$('ending-scene').hidden;stopPresentation();stopPresentationAudio();closePlanning();$('ending-scene').hidden=true;$('release-scene').hidden=true;setPresentationInert(false);
  $('company-name').value=settings.companyName;characterUI.syncForm(characters);$('cancel-new-game').hidden=!started;
  render();$('company-name').focus();
}
$('cancel-new-game').addEventListener('click',()=>{creatingCompany=false;newGameOverwrite=false;render();if(returnToEnding)showEnding();returnToEnding=false;scheduleAutomaticResume();});
function ledger(target,rows) { clear(target); for (const [name,value,isTotal] of rows) { const dt=element('dt',name,isTotal?'total':''); const dd=element('dd',String(value),isTotal?'total':''); target.append(dt,dd); } }
function renderScores(target,scores,focus,animate=true) {
  const key=scores.join(',')+':'+focus;
  if(target.dataset.scores===key)return;
  const previous=[...target.querySelectorAll('strong')].map(node=>Number(node.textContent));
  const token={};target._scoreAnimation=token;target.dataset.scores=key;clear(target);
  const shouldAnimate=animate&&previous.length===3&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counters=[];
  DIRECTIONS.forEach((direction,index)=>{
    const cell=element('div',undefined,`score-cell${focus===direction?' focused':''}`),counter=element('strong',String(shouldAnimate?previous[index]:scores[index]));
    counter.dataset.target=String(scores[index]);const label=element('span',undefined,'score-label');label.append(createDirectionIcon(direction),element('span',DIRECTION_LABELS[direction]));cell.append(label,counter);counters.push(counter);
    const gain=scores[index]-(previous[index]??scores[index]);
    if(shouldAnimate&&gain>0){const pop=element('em',`+${gain}`,'score-gain');cell.append(pop);setTimeout(()=>pop.remove(),1000);}
    target.append(cell);
  });
  if(shouldAnimate){const began=Date.now();const frame=()=>{const now=Date.now();if(target._scoreAnimation!==token)return;const ratio=Math.min(1,(now-began)/650),eased=1-(1-ratio)**3;counters.forEach((node,index)=>{node.textContent=String(Math.round(previous[index]+(scores[index]-previous[index])*eased));});if(ratio<1)requestAnimationFrame(frame);};requestAnimationFrame(frame);}
}

function render() {
  $('welcome').hidden=started&&!creatingCompany; $('game').hidden=!started||creatingCompany;
  $('start-game').disabled=writeBlocked&&!creatingCompany;
  characterUI.render(characters);
  if (!started||creatingCompany) return;
  const currentRank=rank(state),currentChapter=chapterAt(state.gameDay,state),locked=writeBlocked||storageWriteFailed||!!state.ending;
  $('company-title').textContent=settings.companyName;
  $('chapter-label').textContent=currentChapter.title;
  $('cash-value').textContent=state.cash;
  const signal=cashflowSignal(state);$('cashflow-alert').hidden=!signal;if(signal)$('cashflow-alert-copy').textContent=signal;
  $('rank-value').textContent=currentRank===null?'未发布':`# ${currentRank}`;
  $('compute-value').textContent=`${usedCompute(state)} / ${state.compute}`;
  $('rating-value').textContent=ratingLabel(state);
  $('user-count').textContent=new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1}).format(marketSummary(state).users);
  $('day-value').textContent=`第 ${state.gameDay} / ${rulesFor(state).lastDay} 日`;
  renderTimeButton();
  $('time-toggle').disabled=locked;
  $('view-ending').hidden=!state.ending;
  $('speed').value=String(settings.speed); $('speed').disabled=locked;
  $('office-capacity').textContent=`${state.employees.length} / ${state.seats} 工位`;
  $('office-title').textContent=state.seats===8?'城市总部':'创业办公室';
  $('office-caption').textContent=state.ending?'经营已结束，可以查看公司记录。':state.paused?'经营暂停 · 点击继续经营':state.project?.status==='planning'?'负责人正在设计方案':state.project?.status==='researching'?'全员自动研发中':state.project?.status==='experiment'?'团队正在追加实验':'等待新模型立项';
  researchFeedback.sync(state);
  officeSeating=officeSeatAssignments(state,officeSeating);
  office.render(state,{characters,officeSeating}); seatingUI.render(); positionOfficeLabels();
  $('deadline-warning').hidden=state.gameDay<finaleDay(state)||!!state.ending;
  $('deadline-warning').textContent=`最后可发布日：第 ${rulesFor(state).lastDay-1} 日。第 ${rulesFor(state).lastDay} 日结算并进入结局，请及时发布。`;
  $('project-empty').hidden=!!state.project;
  $('project-active').hidden=!state.project;
  $('project-state').textContent=state.ending?(state.project?'本局结束 · 未发布留档':'本局已结束'):state.project?.status==='ready'?'完成待发布':productionSummary(state).phaseLabel;
  renderPlannerChoices();
  $('training-budget').textContent=`立项预付训练预算 ${money(trainingCost(state))}，覆盖四个研发阶段；发布另需 ${money(rulesFor(state).publicationCost)}，工资和设备运行费按账单结算。账上 ${money(state.cash)}。`;
  if (!state.project && (!$('model-name').value || $('model-name').value===lastSuggestedName)) {lastSuggestedName=`Next ${state.nextProjectId}`; $('model-name').value=lastSuggestedName;}
  const summary=productionSummary(state);
  if (state.project) {
    const project=state.project;
    for(const id of ['project-scores','development-attributes'])if($(id).dataset.projectId!==String(project.id)){$(id).dataset.projectId=String(project.id);$(id).dataset.scores='';$(id)._scoreAnimation=null;clear(id);}
    $('project-name').textContent=project.name;
    $('training-paid').textContent=project.trainingCost===undefined?'':`本款训练预算 ${money(project.trainingCost)} 已预付；${state.ending?'未发布成果与已付费用留档。':'继续研发不重复扣款。'}`;
    $('project-description').textContent=`主攻${DIRECTION_LABELS[project.focus]} · 方案负责人 ${EMPLOYEES[project.plannerId]?.name||'待重选'}`;
    renderScores($('project-scores'),project.scores,project.focus);
    $('plan-score-summary').textContent=project.planScores?`方案初始成绩：${project.planScores.join(' · ')}。当前成绩包含全员后续贡献。`:state.ending?'方案未完成，展示结算前的公司积累。':'方案正在设计，当前展示的是公司积累。';
    $('research-estimate').textContent=state.ending?`本局在第 ${state.gameDay} 日结束；研发和发布均已停止。以下为未发布进度，不自动计入榜单。`:project.status==='ready'?(isNextCareer(state)?'评测完成，可查看上线清单并决定发布时机；当前保持暂停。':'研发已完成，经营时间继续。正式发布后才入榜。'):summary.blockedReason||`每天推进 ${summary.progressPerDay}，占用算力 ${summary.usedCompute} / ${state.compute}。按当前团队与算力，${summary.estimatedDays===null?'后续提案、休整与验证会改变工期':`约剩 ${summary.estimatedDays} 日`}；更多算力提高研发速度。`;
    $('research-team-summary').textContent=state.ending?'已产生的方案与团队贡献保留供回看，不再计算新的研发贡献。':project.status==='planning'?'方案由负责人设计；交付后，全体可工作的员工都会按自己的三项能力为模型加分。':project.status==='ready'?'当前三项成绩由方案和团队实际研发共同积累；已经完成的成果不会因员工离职而减少。':`研发团队 ${summary.activeEmployeeIds.length} 人 · 能力合计：${DIRECTIONS.map((direction,index)=>`${DIRECTION_LABELS[direction]} ${summary.teamAbilities[index]}`).join(' · ')}。参与人数和员工能力直接决定榜分，主攻${DIRECTION_LABELS[project.focus]}的贡献加倍。${summary.phaseId==='evaluation'&&summary.activeEmployeeIds.includes('max')?'Max 额外提供 4 点主攻能力贡献。':''}`;
    $('planner-reassignment').hidden=!!state.ending||project.status!=='planning'||project.plannerId!==null;
    $('view-planning').hidden=!!state.ending||project.status!=='planning';
    $('open-release').hidden=!!state.ending||project.status!=='ready';$('open-release').disabled=locked;
  }
  $('development-strip').hidden=!state.project;
  if(state.project){
    renderScores($('development-attributes'),researchFeedback.scores(state),state.project.focus,false);
  }
  updateDevelopmentProgress();
  renderPlanning();
  $('knowledge').textContent=`公司积累：${DIRECTIONS.map((direction,index)=>`${DIRECTION_LABELS[direction]} ${state.knowledge[index]}`).join(' · ')}`;
  renderEmployees(locked); renderBoard(); renderMoney(locked); renderHiring(locked); renderNews(); renderFeedback(locked); renderHistory(); renderGuide(); renderTour();if(!writeBlocked&&!storageWriteFailed)careerUI.render();managementUI.render();office.setManagementEvent?.(managementUI.officeEvent());
  $('office-project-summary').textContent=state.project?`${state.project.name} · ${state.ending?'未发布留档':state.project.status==='ready'?'等待发布':`${state.project.work} / ${projectStages(state).reduce((n,item)=>n+item.work,0)}`}`:'还没有在研项目';
  $('nav-project-status').textContent=state.ending?'成果留档':state.project?.status==='ready'?'可以发布':state.project?'研发中':'等待立项';
  $('new-game').disabled=false;
  displayStorageProblem();
}
function abilityText(id) {return DIRECTIONS.map((d,i)=>`${DIRECTION_LABELS[d]} ${employeeAbilities(state,id)[i]}`).join(' · ');}
function selectedPlanner(id){
  return $(id).querySelector('input[type=radio]:checked:not(:disabled)')?.value||'';
}
function updatePlannerSelection(){
  const selected=selectedPlanner('project-planner');
  $('planner-abilities').textContent=state.ending?'本局已结束，方案负责人记录仅供回看。':selected?`已选择 ${EMPLOYEES[selected].name} 制定方案。`:state.employees.length?'目前没有可安排的负责人，可继续时间等待辅助任务或休整完成。':'当前没有员工，请先到人才市场招聘。';
  $('create-project').disabled=writeBlocked||!!state.ending||!!state.project||!selected||state.cash<trainingCost(state,isCareer(state)?careerUI.trainingPlan():'standard');
  $('confirm-planner').disabled=writeBlocked||!!state.ending||!selectedPlanner('replacement-planner')||state.project?.status!=='planning'||state.project.plannerId!==null;
}
function renderPlannerChoices(){
  const locked=writeBlocked||!!state.ending;
  const available=state.employees.filter(id=>state.assignments[id]?.kind!=='reset'&&(!isCareer(state)||state.career.study?.employeeId!==id));
  const key=JSON.stringify([locked,state.employees.map(id=>[id,employeeAbilities(state,id),state.assignments[id]?.finishDay??null,isCareer(state)?state.career.study?.employeeId:null])]);
  for(const id of ['project-planner','replacement-planner']){
    const target=$(id),previous=target.querySelector('input:checked')?.value;
    const selection=available.includes(previous)?previous:available[0];
    if(target.dataset.roster!==key){
      const focused=target.contains(document.activeElement)?document.activeElement.value:null;
      target.replaceChildren();target.dataset.roster=key;
      for(const employeeId of state.employees){
        const busy=state.assignments[employeeId]?.kind==='reset'||isCareer(state)&&state.career.study?.employeeId===employeeId;
        const card=element('label',undefined,`planner-option${busy?' is-busy':''}`);card.dataset.employee=employeeId;
        const heading=element('span',undefined,'planner-option-heading'),input=element('input');
        input.type='radio';input.name=id;input.value=employeeId;input.required=true;input.disabled=locked||busy;input.checked=employeeId===selection;
        const selectedTag=element('span','已选','planner-selected');selectedTag.setAttribute('aria-hidden','true');
        heading.append(input,createCharacterPortrait(employeeId,{size:34}),element('strong',EMPLOYEES[employeeId].name),selectedTag);
        const stats=element('span',undefined,'planner-stats'),abilities=employeeAbilities(state,employeeId);
        DIRECTIONS.forEach((direction,index)=>{const stat=element('span',undefined,'planner-stat');stat.dataset.direction=direction;const label=element('span',undefined,'score-label');label.append(createDirectionIcon(direction),element('span',DIRECTION_LABELS[direction]));stat.append(label,element('strong',String(abilities[index])));stats.append(stat);});
        card.append(heading,stats);
        if(busy)card.append(element('span',state.ending?(state.assignments[employeeId]?'额度重置未完成 · 本局已结束':'辅助任务未完成 · 本局已结束'):state.assignments[employeeId]?`重置额度中 · 预计第 ${quotaResetStatus(state).finishDay} 日完成`:'正在辅助研修','planner-unavailable'));
        target.append(card);
      }
      if(!state.employees.length)target.append(element('p','暂无可选员工。','muted'));
      if(focused)Array.from(target.querySelectorAll('input')).find(input=>input.value===focused&&!input.disabled)?.focus({preventScroll:true});
    }
    const focus=id==='replacement-planner'?state.project?.focus:$('focus').value;
    for(const stat of target.querySelectorAll('.planner-stat'))stat.classList.toggle('is-focus',stat.dataset.direction===focus);
  }
  updatePlannerSelection();
}
function renderResetControl(button,statusLine) {
  const reset=quotaResetStatus(state),tooLate=!state.ending&&(reset.available||reset.reason==='reset-running')&&reset.finishDay>rulesFor(state).lastDay;
  button.disabled=writeBlocked||!reset.available;
  button.textContent=state.ending?(state.assignments.rebo?'额度重置未完成':'重置额度 · 本局已结束'):reset.reason==='reset-running'?(tooLate?'重置未完成 · 当前安排超出本局期限':`重置中 · 预计第 ${reset.finishDay} 日完成`):`重置额度 · ${reset.cost} 万`;
  statusLine.textContent=state.ending?(state.assignments.rebo?'本局已结束，已付费用留在记录中；未完成的重置不会再提高评价。':'本局已结束，不能再使用主动能力。'):writeBlocked?'请先处理存档冲突，再使用能力。':tooLate?`按当前休整安排，最早第 ${reset.finishDay} 日完成，晚于本局第 ${rulesFor(state).lastDay} 日结束；未完成重置不提高评价，已付费用不退。可先调整休整，再核对完成日。`:reset.reason==='reset-running'?`需要推进游戏时间；按当前体力预计第 ${reset.finishDay} 日完成，休整会延后。`:reset.available?`预计第 ${reset.finishDay} 日完成，用户评价 ${(state.ratingTenths/10).toFixed(1)} → ${(reset.ratingAfter/10).toFixed(1)} / 5。`:actionError(reset.reason)+(reset.reason==='rebo'?` ${recruitmentStatus(state,'rebo').hint}。`:'');
}
function useResetAbility() {
  const reset=quotaResetStatus(state);
  act({type:'reset'},'reset',`Rebo 已开始重置，支付 ${reset.cost} 万；${reset.finishDay>rulesFor(state).lastDay?'按当前休整安排无法在本局结束前完成，未完成不提高评价，费用不退。':`预计第 ${reset.finishDay} 日完成，期间暂不参与方案和研发。`}`);
}
function renderSpecialAbility(id) {
  const ability=specialAbility(state,id);if(!ability)return null;
  const box=element('section',undefined,`staff-ability${id==='rebo'?' active-ability':''}`),heading=element('div',undefined,'ability-heading');
  box.dataset.ability=id;heading.append(element('strong',ability.name),element('span',ability.mode,'badge'));
  box.append(heading,element('p',ability.copy));
  if(id==='rebo'){
    const button=element('button',undefined,'primary'),status=element('p',undefined,'ability-status');button.id='team-reset-quota';status.id='team-reset-status';status.setAttribute('role','status');
    button.addEventListener('click',useResetAbility);renderResetControl(button,status);box.append(button,status);
  }else box.append(element('p',ability.status,'ability-status'));
  return box;
}
function renderEmployees(locked) {
  const list=clear('employee-list');
  if(!state.employees.length)list.append(element('p','先去人才市场招聘。新同事会自动加入后续研发。','muted'));
  for(const id of state.employees){
    const employee={...EMPLOYEES[id],...employeeTerms(state,id)},activity=employeeActivity(state,id),row=element('div',undefined,'employee-row');row.dataset.employee=id;
    const growth=rulesFor(state);
    const experience=DIRECTIONS.map((d,i)=>`${DIRECTION_LABELS[d]}${state.employeeExperience[id][i]>=growth.experiencePerPoint*(isCareer(state)?state.career.caps[id]?.[i]??6:growth.maxAbilityGrowth)?'成长已满':`经验 ${state.employeeExperience[id][i]%growth.experiencePerPoint} / ${growth.experiencePerPoint}`}`).join(' · ');
    const text=element('div');text.append(element('strong',employee.name),element('p',abilityText(id)),element('p',experience,'employee-experience'),element('p',`工资 ${employee.salary} 万 / 7 日 · ${activity.label}${state.paused?'（时间暂停）':''}`));
    const dismiss=element('button','辞退');dismiss.dataset.testid=`dismiss-${id}`;dismiss.disabled=locked;
    dismiss.addEventListener('click',()=>{
      const impact=dismissalImpact(state,id);
      if(!impact.ok){showMessage(actionError(impact.error),true);return;}
      const copy=element('section');
      copy.append(element('p',`支付 ${money(impact.cost)} 赔偿，付款后剩余 ${money(impact.cashAfter)}。已产生的研发成果保留。`,'impact-lead'));
      for(const effect of impact.effects)copy.append(element('p',effect));
      showConfirm(`辞退 ${employee.name}？`,copy,()=>{if(act({type:'dismiss',employeeId:id},'dismiss'))showMessage(`${employee.name}：${FAREWELLS[id]}`);},{danger:true,confirmLabel:'辞退员工'});
    });
    row.append(createCharacterPortrait(id),text,dismiss);const ability=renderSpecialAbility(id);row.append(ability||element('span',EMPLOYEE_TRAITS[id],'task-detail'));list.append(row);
  }
}
function renderBoard() {
  const direction=$('board-direction').value==='overall'?null:Number($('board-direction').value);
  hideModelTooltip();
  const list=clear('leaderboard');
  board(state,direction).forEach((model,index)=>{
    const row=element('li',undefined,model.company==='player'?'player-row':'');
    const info=element('button',undefined,'model-info-button');info.type='button';info.dataset.modelId=model.id;
    const company=model.company==='player'?settings.companyName:model.company;
    info.setAttribute('aria-label',`${company} ${model.name}，查看模型介绍`);info.setAttribute('aria-expanded','false');
    info.append(element('strong',company),element('span',model.name));
    info.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')showModelTooltip(info,model);});
    info.addEventListener('pointerleave',event=>{if(tooltipAnchor===info&&!tooltipPinned&&!$('model-tooltip').contains(event.relatedTarget)&&document.activeElement!==info)hideModelTooltip();});
    info.addEventListener('focus',()=>showModelTooltip(info,model));
    info.addEventListener('blur',()=>{if(tooltipAnchor===info&&!tooltipPinned)hideModelTooltip();});
    info.addEventListener('click',()=>{if(tooltipAnchor===info&&tooltipPinned)hideModelTooltip();else showModelTooltip(info,model,true);});
    row.append(element('b',String(index+1)),info,element('strong',String(direction===null?total(model):model.scores[direction]),'board-score'));list.append(row);
  });
}
function renderMoney(locked) {
  const market=marketSummary(state),promotion=mediaCampaign(state);$('audience-summary').textContent=state.ending?`结束时记录：活跃用户 ${market.users.toLocaleString()} · 付费订阅 ${market.subscribers.toLocaleString()}；本局不再产生订阅收入。`:`活跃用户 ${market.users.toLocaleString()} · 付费订阅 ${market.subscribers.toLocaleString()} · 预计订阅 ${market.weeklyIncome} 万 / 7 日`;
  const base=baseSubscriptionIncome(state),established=(isCareer(state)||state.subscriptionGrowthEnabled)&&state.funding.includes('overall');
  $('subscription-status').textContent=established?'已取得综合榜首融资，订阅档位已提高；后续掉榜仍保留这个档位，具体金额按当前名次变化。':state.subscriptionGrowthEnabled?'取得综合榜首融资后，订阅档位会提高；之后无需一直第一，也能保留这个档位。':'订阅收入按当前综合名次计算。';
  const support=isNextCareer(state)?supportCost(state,careerSubscription(state)):0;
  const {salaries,running}=operatingCosts(state),income=Math.max(0,market.weeklyIncome+state.pendingBonus+state.pendingNews),nextBill=Math.min(rulesFor(state).lastDay,(Math.floor(state.gameDay/7)+1)*7);
  $('next-bill-day').textContent=state.ending?'本局已结束 · 不再产生账单':`第 ${nextBill} 日到账`;
  const ledgerHelp=$('bill-preview').nextElementSibling;
  if(ledgerHelp?.classList.contains('fineprint'))ledgerHelp.textContent=state.ending?'这里只保留结束时现金和已发生的账单；未结算的奖励与行业调整不再入账，未完成任务不再产生收益。':'账单预估随名次与人员变化，不含新项目的训练费、发布费和采购费。待到账收入不能提前花。';
  if(state.ending){
    const last=state.bills.at(-1);
    $('subscription-status').textContent='公司经营已停止；订阅来源、员工与设备保留为历史记录，不再结算新的收入或费用。';
    ledger($('bill-preview'),[['结束日',`第 ${state.gameDay} 日`],['最终现金',money(state.cash),true],...(last?[['最后实际账单',`第 ${last.day} 日`],['实际收入',money(last.income)],['实际工资与设备',`−${last.salaries+last.running} 万`],...(last.support!==undefined?[['实际服务支持费',`−${last.support} 万`]]:[]),['最后账单后现金',money(last.cash)]]:[['实际账单','尚无账单记录']]),...(state.pendingBonus?[['未结算奖励（不再到账）',money(state.pendingBonus)]]:[]),...(state.pendingNews?[['未结算行业调整（不再入账）',`${state.pendingNews>=0?'+':''}${state.pendingNews} 万`]]:[])]);
  }else ledger($('bill-preview'),[[isCareer(state)?(careerSubscription(state).direction!==null?'专项计费订阅':established?'综合订阅（登顶后档位）':'综合计费订阅'):(established?'当前名次订阅（登顶后档位）':'当前名次基础订阅'),money(base)],['媒体带来的订阅',promotion.income?`${money(promotion.income)} / 期，至第 ${promotion.untilDay} 日`:'无有效推广'],[rulesFor(state).mediaIncome?'发布奖励待到账':'发布与报道奖励待到账',money(state.pendingBonus)],['行业消息待调整',`${state.pendingNews>=0?'+':''}${state.pendingNews} 万`],['工资与设备运行',`−${salaries+running} 万`],...(isNextCareer(state)?[['服务支持费用',`−${support} 万`]]:[]),['下次账单预计净额',`${income-salaries-running-support>=0?'+':''}${income-salaries-running-support} 万`,true],['按当前条件结算后现金',money(state.cash+income-salaries-running-support),true]]);
  $('compute-price').textContent=`每单位 ${price(state)} 万 · 每 7 日运行费 ${rulesFor(state).computeRunningCost??1} 万 · 容量 ${state.compute} / 8`;
  $('buy-compute').disabled=locked||state.compute>=8||state.cash<price(state);$('buy-compute').title=state.cash<price(state)?'当前现金不足':'';
  $('expansion-detail').textContent=state.seats===8?'新总部已经启用，会议室与八个工位就绪。':'30 万 · 搬入更大的新总部，提供 8 个工位';
  $('expand-office').disabled=locked||state.seats===8||state.cash<30;$('expand-office').title=state.cash<30?'当前现金不足':'';
  const funding=clear('funding-records');
  const fundingRules=rulesFor(state),minimum=fundingRules.fundingPublications;
  const count=id=>minimum?`已发布至少 ${minimum[id]} 款，`:'';
  const names={seed:`${count('seed')}模型达到 ${fundingRules.seedScore} 分：40 万`,specialist:`${count('specialist')}专项榜首：80 万`,overall:`${count('overall')}综合榜首：160 万`};
  for(const [id,text]of Object.entries(names))funding.append(element('p',`${state.funding.includes(id)?'已到账':'尚未达成'} · ${text}`,'fineprint'));
  const bills=clear('bill-history');
  if(!state.bills.length)bills.append(element('p','第一张账单尚未结算。','muted'));
  for(const bill of state.bills.slice(-4).reverse())bills.append(element('p',`第 ${bill.day} 日：收入 ${bill.income}，工资 ${bill.salaries}，运行 ${bill.running}${bill.support!==undefined?`，支持 ${bill.support}`:''}；余额 ${bill.cash} 万。`,'fineprint'));
}
function renderHiring(locked) {
  const list=clear('hiring-list');
  const hints=[...new Set(Object.keys(EMPLOYEES).filter(id=>EMPLOYEES[id].hire&&!recruitmentStatus(state,id).unlocked&&!state.employees.includes(id)&&!state.dismissed.includes(id)).map(id=>recruitmentStatus(state,id).hint))];
  $('hiring-unlocks').textContent=hints.length?`后续人才：${hints.join('；')}`:'所有阶段的人才都已开放。已离职员工本局不会再次应聘。';
  for(const [id,identity]of Object.entries(EMPLOYEES)){
    const employee={...identity,...employeeTerms(state,id)};
    if(!employee.hire)continue;
    const eligibility=recruitmentStatus(state,id);
    if(!eligibility.unlocked&&!state.employees.includes(id)&&!state.dismissed.includes(id))continue;
    const card=element('div',undefined,'candidate');card.append(createCharacterPortrait(id,{size:48}),element('h3',employee.name),element('p',abilityText(id),'employee-abilities'),element('p',`${DIRECTION_LABELS[employee.specialty]} · 招聘 ${employee.hire} 万 · 工资 ${employee.salary} 万`),element('p',specialAbility(state,id)?`${specialAbility(state,id).mode} · ${specialAbility(state,id).copy}`:EMPLOYEE_TRAITS[id]));
    const employed=state.employees.includes(id),dismissed=state.dismissed.includes(id);
    const button=element('button',employed?'已入职':dismissed?'已离职':'招聘');button.dataset.testid=`hire-${id}`;button.disabled=locked||employed||dismissed;
    button.addEventListener('click',()=>act({type:'hire',employeeId:id},'hire',`${employee.name} 入职，新的工位已经亮起。${id==='rebo'?'可在「团队能力」的 Rebo 卡片使用重置额度。':''}`));card.append(button);list.append(card);
  }
}
function renderNews() {
  if(isCareer(state)){careerUI.renderFeed();return;}
  const list=clear('news-list');
  const scenes=reachedStoryScenes(state,observedStoryEvents);
  if(scenes.length){
    const archive=element('details',undefined,'story-archive');archive.append(element('summary','办公室片段 · 回看'));
    for(const scene of [...scenes].reverse()){
      const button=element('button',`第 ${scene.day} 日 · ${scene.title}`);button.dataset.storyId=scene.id;
      button.addEventListener('click',()=>openStory(scene.id,observedStoryEvents.includes(scene.id)));archive.append(button);
    }
    list.append(archive);
  }
  for(const news of newsFor(state).slice(0,32)){
    const article=element('article',undefined,'news-item');article.dataset.newsId=news.id;
    article.append(element('span',`第 ${news.day} 日`,'eyebrow'),element('h3',news.title),element('p',news.copy));
    if(news.model){const button=element('button',news.model.company==='DeepPeek'?'查看模型资料与成绩':'查看发布会与成绩');button.addEventListener('click',()=>{pauseForReading();present(news.model,null,true);});article.append(button);}
    list.append(article);
  }
}
function openModelRecord(modelId){
  openPanel('ranking');if(!$('panel-ranking').open)return;
  const row=[...$('model-history').children].find(n=>n.dataset.modelId===modelId);if(!row)return;
  $('model-history').closest('details').open=true;for(const details of row.querySelectorAll('details'))details.open=true;row.scrollIntoView({block:'center'});row.focus({preventScroll:true});
}
function renderFeedback(locked) {
  const list=clear('feedback-list'),models=state.models.filter(model=>model.company==='player');
  if(!models.length){list.append(element('p','还没发布模型，暂时没有用户留言。','muted'));}
  for(const model of models.slice(-3).reverse()){
    const box=element('div',undefined,'feedback');box.append(element('strong',`${model.name} · 用户留言`));
    const releaseFeedback=managementFeedback?.events.find(e=>e.type==='release'&&e.data.modelId===model.id);
    if(releaseFeedback?.comments.length)for(const c of releaseFeedback.comments)box.append(element('strong',c.author),element('p',c.text),element('small',c.fact));else box.append(element('p',userFeedback(model).copy));
    if(isNextCareer(state)&&model.issues){const outstanding=unresolvedIssues(model).length;box.append(element('p',outstanding?`当前仍有 ${outstanding} 项上线问题，回复留言不会自动修复。`:'当前没有待处理的上线问题，历史发布留言保持。','fineprint'));const maintain=element('button',outstanding?'查看型号并安排维护':'查看型号履历');maintain.addEventListener('click',()=>openModelRecord(model.id));box.append(maintain);}
    for(const answer of ['已收到','下版处理']){const button=element('button',feedbackResponses[model.id]===answer?`✓ ${answer}`:answer);button.disabled=locked;button.addEventListener('click',()=>{if(writeBlocked)return;const previous=feedbackResponses[model.id];feedbackResponses[model.id]=answer;save();if(writeBlocked){if(previous===undefined)delete feedbackResponses[model.id];else feedbackResponses[model.id]=previous;render();return;}safeSound('ui');renderFeedback(locked);});box.append(button);}list.append(box);
  }
  $('reset-ability-copy').textContent=specialAbility(state,'rebo').copy;
  renderResetControl($('reset-quota'),$('reset-quota-status'));
}
function renderHistory() {
  renderModelHistory($('model-history'),state,model=>{pauseForReading();present(model,null,true);});
}
function releaseCost() { if(isCareer(state))careerUI.refreshPolicy();const host=publicationPresenter(state);const cost=rulesFor(state).publicationCost+($('media').value?mediaCost(state,host):0);$('publish-model').disabled=!host||writeBlocked||state.cash<cost;$('publish-error').textContent=host?'':'等待一位员工结束手头工作后即可发布。';$('publish-cost').textContent=`发布费 ${money(rulesFor(state).publicationCost)}${$('media').value?` + 报道费 ${money(mediaCost(state,host))}`:''}，此次支出 ${money(cost)}。训练预算已支付，账上现金 ${money(state.cash)}。`;
  const promotion=mediaCampaign(state),periods=Math.max(0,Math.min(2,Math.floor(rulesFor(state).lastDay/7)-Math.floor(state.gameDay/7)));
  $('media-benefit').textContent=rulesFor(state).mediaIncome?`报道带来接下来 ${periods} 次账单各 ${money(rulesFor(state).mediaIncome)} 订阅收入（共 ${money(rulesFor(state).mediaIncome*periods)}），对应 ${rulesFor(state).mediaIncome*500} 名推广付费用户；提前再投只刷新有效期，不叠加。${promotion.income?`已有推广至第 ${promotion.untilDay} 日。`:''}`:'报道奖励在下一张账单到账。'; }
function openRelease() {
  pauseForReading();if(state.project?.status!=='ready')return;closeDialogs();
  $('release-plan').textContent=`${state.project.name} · 主攻${DIRECTION_LABELS[state.project.focus]} · 综合分 ${total(state.project)}`;
  $('publish-error').textContent='';
  const promptId=`release-prompt:${state.project.id}`;if(!observedStoryEvents.includes(promptId)){observedStoryEvents.push(promptId);save();}
  $('media').value='';$('publication-policy').value='closed';releaseCost();$('release-dialog').showModal();
}
function stopPresentation() { for(const timer of presentationTimers)clearTimeout(timer);presentationTimers=[]; }
function stopPresentationAudio() { audio.stop('publish'); if(presentationCue)audio.stop(presentationCue); presentationCue=null; }
function setPresentationInert(active) { $('game').inert=active;document.querySelector('.masthead').inert=active;document.querySelector('footer').inert=active; }
function historicRank(model) {const historical={...state,models:state.models.filter(item=>item.sequence<=model.sequence)};return board(historical).findIndex(item=>item.company===model.company)+1;}
function present(model,result,replay=false) {
  closePlanning();closeDialogs();stopPresentation();stopPresentationAudio();reportShown=false;setPresentationInert(true);
  if(result&&!replay){
    const oldRank=rank(result.before),newRank=rank(result.after);
    presentationCue=result.after.funding.length>result.before.funding.length?'funding':oldRank!==null&&newRank!==null&&oldRank!==newRank?(newRank<oldRank?'rankUp':'rankDown'):null;
  }
  const scene=$('release-scene'),isPlayer=model.company==='player',modelRank=historicRank(model);
  scene.hidden=false;scene.dataset.phase='reveal';scene.dataset.modelId=model.id;scene.classList.toggle('quiet-release',model.company==='DeepPeek');
  scene.querySelector('.stage-art').hidden=model.company==='DeepPeek';
  $('release-tag').textContent=replay?'发布回顾 · 不重复结算':'正式发布 · 成绩已入榜';
  $('release-company').textContent=`${isPlayer?settings.companyName:model.company} · 第 ${model.day} 日`;
  $('release-title').textContent=model.name;
  $('release-subtitle').textContent=isPlayer?`主攻${DIRECTION_LABELS[model.focus]} · 主持人：${EMPLOYEES[model.presenter]?.name||'公司团队'}`:model.company==='DeepPeek'?'模型文件、技术报告和价格表已上线。资料署名：Liang Wenfong。':`${model.company} 公布了 ${model.name} 的评测成绩。`;
  renderScores($('release-scoreboard'),model.scores,model.focus,false);
  drawRelease($('release-art'),{presenter:model.presenter||'avery'});
  $('release-headline').textContent=isPlayer?mediaHeadline(model,modelRank,state.models):`${model.company} · 发布时综合榜第 ${modelRank}`;
  const rows=[['综合成绩',`${total(model)} 分`],['发布时公司综合名次',`第 ${modelRank} 名`]];
  if(result){const beforeRank=rank(result.before),afterRank=rank(result.after),newFunding=result.after.notices.slice(result.before.notices.length).filter(notice=>notice.type==='funding').reduce((value,notice)=>value+notice.amount,0);rows.push(['本次公司名次变化',`${beforeRank===null?'未上榜':`第 ${beforeRank} 名`} → 第 ${afterRank} 名`],['发布与媒体支出',`−${rulesFor(state).publicationCost+(model.media?mediaCost(state,model.presenter):0)} 万`],['本次融资已到账',`+${newFunding} 万`],['本次奖励待下期到账',`+${result.after.pendingBonus-result.before.pendingBonus} 万`],['当前可用现金',money(result.after.cash),true]);}
  else if(isPlayer)rows.push(['当次发布与媒体支出',money(rulesFor(state).publicationCost+(model.media?mediaCost(state,model.presenter):0))],['本次为回看','不扣费，不发钱']);
  if(model.burstBonus!==undefined)rows.push(['火爆额外贡献',`${model.burstBonus} 点主攻属性（已计入成绩）`]);
  if(model.trainingCost!==undefined)rows.push(['训练预算（立项已支付）',money(model.trainingCost)]);
  if(model.mediaUntilDay!==undefined)rows.push(['报道转化',`每次账单加 ${money(model.mediaIncome)}，至第 ${model.mediaUntilDay} 日；推广不叠加`]);
  ledger($('release-ledger'),rows);
  $('release-comment').textContent=isPlayer?playerReleaseCopy(model):rivalCopy(model);
  document.getElementById('management-release-card')?.remove();if(isPlayer&&isCareer(state)){const card=managementUI.releaseCard(model);card.id='management-release-card';$('release-comment').after(card);}
  $('skip-release').hidden=false;
  $('release-title').focus();
  if(!replay)safeSound('publish');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||replay)finishPresentation();
  else {presentationTimers.push(setTimeout(()=>{scene.dataset.phase='scores';},900),setTimeout(finishPresentation,2600));}
}
function finishPresentation() { if(reportShown)return; reportShown=true; stopPresentation(); audio.stop('publish'); $('release-scene').dataset.phase='report'; $('skip-release').hidden=true; if(presentationCue)safeSound(presentationCue); }
function closePresentation() {stopPresentation();stopPresentationAudio();$('release-scene').hidden=true;setPresentationInert(false);$('secretary-action').focus();lastFrame=performance.now();showMilestone();scheduleAutomaticResume();}
function showEnding() {
  flushResearchFeedback();
  resumeAfterInterruption=false;
  closePlanning();closeDialogs();stopPresentation();stopPresentationAudio();$('release-scene').hidden=true;setPresentationInert(true);$('ending-scene').hidden=false;
  $('ending-title').textContent=state.ending;$('ending-copy').textContent=ENDING_COPY[state.ending];
  const owned=state.models.filter(model=>model.company==='player');
  ledger($('ending-stats'),[['经营时间',`${state.gameDay} 日`],['发布模型',`${owned.length} 款`],['最后综合名次',rank(state)===null?'未上榜':`第 ${rank(state)} 名`],['获得融资',`${state.funding.length} 项`],['员工与算力',`${state.employees.length} 人 · ${state.compute} 单位`],['用户评价',ratingLabel(state)],['最终现金',money(state.cash),true]]);
  $('ending-unpublished').textContent=state.project?`未发布成果：${state.project.name}，进度 ${state.project.work} / ${projectStages(state).reduce((n,item)=>n+item.work,0)}。它留在报告里，没有自动上榜。`:'所有已发布成绩都保留在公司记录中。';
  $('ending-title').focus();
}


function closeDialogs() {
  hideTour(); hideModelTooltip();
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
}
function showStorageRecovery() {
  if(!started||(!writeBlocked&&!storageWriteFailed))return;
  resumeAfterInterruption=false;confirmAction=null;
  if($('settings-dialog').open){displayStorageProblem();return;}
  closeDialogs();closePlanning();stopPresentation();stopPresentationAudio();
  $('release-scene').hidden=true;$('ending-scene').hidden=true;setPresentationInert(false);
  displayStorageProblem();$('settings-dialog').showModal();$('settings-storage-title').focus();
}
function retryStorageSave(){
  if(!storageWriteFailed||writeBlocked)return;
  resumeAfterInterruption=false;
  if(!save())return;
  $('settings-dialog').close();render();showMessage('已重新保存，经营保持暂停。');
}
function openPanel(name) {
  const panel=$(`panel-${name}`);
  if (!panel?.classList.contains('management-panel') || !started) return;
  if(writeBlocked||storageWriteFailed){showStorageRecovery();return;}
  pauseForReading(); closeDialogs();
  if(!state.ending&&isCareer(state)&&(pendingProjectDecision(state)||state.career.assessment)){careerUI.renderDecision();return;}
  if(name==='finance'&&state.models.some(model=>model.company==='player')&&!observedStoryEvents.includes('guide-finance-reviewed')){observedStoryEvents.push('guide-finance-reviewed');save();}
  render(); panel.querySelector('.panel-message').hidden=true; panel.showModal(); if(name==='seating')seatingUI.render(true);safeSound('ui');
}
function renderGuide() {
  const step=onboardingStep(state,{skipped:settings.guideSkipped,financeReviewed:observedStoryEvents.includes('guide-finance-reviewed')});
  $('guide-dialog').dataset.guideStep=step.id;
  $('game').dataset.guideStep=step.id;
  $('guide-title').textContent=step.title;
  $('guide-copy').textContent=step.copy;
  $('guide-goal').textContent=`当前目标：${step.goal}`;
  $('guide-primary').textContent=step.action;
  $('guide-primary').disabled=writeBlocked;
  $('guide-skip').hidden=!!step.complete;
  $('secretary-summary').textContent=settings.guideSkipped?'需要帮忙就叫我。':step.goal;
  $('secretary-action').textContent=settings.guideSkipped?'查看当前目标':step.action;
  $('secretary-action').disabled=writeBlocked;
  document.querySelectorAll('[data-panel-target]').forEach(button=>button.classList.toggle('current-goal',!tourActive && step.showGuidance && button.dataset.panelTarget===step.target));
  $('time-toggle').classList.toggle('current-goal',!tourActive && step.showGuidance && step.target==='resume');
}
function showGuide() {
  if (!started) return;
  if(writeBlocked||storageWriteFailed){showStorageRecovery();return;}
  pauseForReading(); closeDialogs(); renderGuide(); $('guide-dialog').showModal();
}
function followGuide() {
  if(writeBlocked||storageWriteFailed){showStorageRecovery();return;}
  const step=onboardingStep(state,{financeReviewed:observedStoryEvents.includes('guide-finance-reviewed')});
  closeDialogs();
  if (step.target==='release') openRelease();
  else if(step.target==='decision'){if(state.project?.decisionWaiting)act({type:'reviewProjectDecision'});careerUI.renderDecision();}
  else if(step.target==='assessment')careerUI.renderDecision();
  else if (step.target==='resume') {act({type:'resume'},'ui');lastFrame=performance.now();}
  else openPanel(step.target);
}
for(const button of document.querySelectorAll('[data-panel-target]'))button.addEventListener('click',()=>openPanel(button.dataset.panelTarget));
for(const button of document.querySelectorAll('[data-close-panel],[data-return-office]'))button.addEventListener('click',()=>{closeDialogs();$('secretary-action').focus();});
$('guide-primary').addEventListener('click',followGuide);
$('secretary-action').addEventListener('click',()=>settings.guideSkipped?showGuide():followGuide());
$('guide-help').addEventListener('click',()=>{settings.guideSkipped=false;saveSettings();showGuide();});
$('guide-skip').addEventListener('click',()=>{settings.guideSkipped=true;saveSettings();$('guide-dialog').close();renderGuide();showMessage('引导已收起，需要时可以随时问小满。');});
$('guide-close').addEventListener('click',()=>$('guide-dialog').close());
$('export-legacy-save').addEventListener('click',()=>{
  try {
    const key=$('legacy-save-slot').value;if(!LEGACY_SAVE_KEYS.includes(key))return;const raw=localStorage.getItem(key);
    if(raw===null){showMessage('没有找到旧版存档。',true);return;}
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
    const link=element('a');link.href=url;link.download=key+'.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showMessage('旧版存档已导出，浏览器中的原文仍然保留。');
  }catch{showMessage('浏览器无法导出旧版存档，请检查下载权限。',true);}
});


function positionOfficeLabels() {
  const canvas=$('office'),scene=canvas.parentElement,box=canvas.getBoundingClientRect(),bounds=scene.getBoundingClientRect();
  for(const [id,prefix]of [['office-boss-label','boss'],['office-secretary-label','secretary']]){
    const label=$(id),x=Number(canvas.dataset[`${prefix}LabelX`]),y=Number(canvas.dataset[`${prefix}LabelY`]);
    label.hidden=!Number.isFinite(x)||!Number.isFinite(y)||box.width<=0;
    if(label.hidden)continue;
    const left=box.left-bounds.left+x*box.width/canvas.width;
    const top=box.top-bounds.top+y*box.height/canvas.height;
    const half=label.offsetWidth/2;
    label.style.left=`${Math.max(half+3,Math.min(scene.clientWidth-half-3,left))}px`;
    label.style.top=`${Math.max(2,Math.min(scene.clientHeight-label.offsetHeight-2,top))}px`;
  }
}
new ResizeObserver(positionOfficeLabels).observe($('office'));
$('office').addEventListener('office-layout',positionOfficeLabels);
function hideTour() {
  tourActive=false;
  $('office-tour').hidden=true;
  document.body.classList.remove('tour-active');
  delete document.body.dataset.tourStep;
  document.querySelectorAll('.tour-highlight').forEach(node=>node.classList.remove('tour-highlight'));
  if(started)renderGuide();
}
function renderTour() {
  const step=tourStep(settings);
  $('office-tour').hidden=!tourActive;
  document.body.classList.toggle('tour-active',tourActive);
  document.querySelectorAll('.tour-highlight').forEach(node=>node.classList.remove('tour-highlight'));
  if(!tourActive){delete document.body.dataset.tourStep;return;}
  $('office-tour').dataset.tourStep=step.id;document.body.dataset.tourStep=step.id;
  $('tour-count').textContent=`${step.index+1} / ${step.count}`;
  $('tour-title').textContent=step.title;$('tour-copy').textContent=step.copy;
  clear('tour-list');for(const text of step.items)$('tour-list').append(element('li',text));
  $('tour-back').disabled=step.index===0;
  $('tour-next').textContent=step.index===step.count-1?'看看当前任务':'下一步';
  for(const selector of step.targets)document.querySelector(selector)?.classList.add('tour-highlight');
}
function showTour(restart=false) {
  if(!started)return;
  pauseForReading();closeDialogs();
  if(restart)Object.assign(settings,updateTourProgress(settings,'restart'));
  tourActive=true;saveSettings();renderGuide();renderTour();
  $('tour-next').focus({preventScroll:true});
}
function moveTour(action) {
  Object.assign(settings,updateTourProgress(settings,action));saveSettings();
  if(settings.tourCompleted){hideTour();if(action==='next')showGuide();else {showMessage('办公室介绍已收起，可以随时点“办公室介绍”重看。');scheduleAutomaticResume();}}
  else {renderTour();$('tour-title').focus({preventScroll:true});}
}
function hideModelTooltip() {
  const tooltip=$('model-tooltip');
  if(tooltip.hidePopover&&tooltip.matches(':popover-open'))tooltip.hidePopover();
  tooltip.hidden=true;
  if(tooltipAnchor){tooltipAnchor.removeAttribute('aria-describedby');tooltipAnchor.setAttribute('aria-expanded','false');}
  tooltipAnchor=null;tooltipPinned=false;
}
function positionModelTooltip() {
  if(!tooltipAnchor)return;
  const tooltip=$('model-tooltip'),anchor=tooltipAnchor.getBoundingClientRect();
  const width=tooltip.offsetWidth,height=tooltip.offsetHeight,margin=8;
  const left=Math.max(margin,Math.min(innerWidth-width-margin,anchor.left));
  const desiredTop=anchor.bottom+height+margin*2<=innerHeight?anchor.bottom+margin:anchor.top-height-margin;
  const top=Math.max(margin,Math.min(innerHeight-height-margin,desiredTop));
  tooltip.style.left=`${left}px`;tooltip.style.top=`${top}px`;
}
function showModelTooltip(anchor,model,pinned=false) {
  if(tooltipAnchor&&tooltipAnchor!==anchor)hideModelTooltip();
  const tooltip=$('model-tooltip'),intro=modelIntroduction(model);
  tooltipAnchor=anchor;tooltipPinned=pinned||tooltipPinned;
  $('model-tooltip-title').textContent=model.name;
  $('model-tooltip-description').textContent=intro.description;
  $('model-tooltip-focus').textContent=`${model.company==='player'?'主攻':'榜分强项'}：${intro.focus}`;
  $('model-tooltip-release').textContent=intro.release;
  tooltip.hidden=false;
  if(tooltip.showPopover&&!tooltip.matches(':popover-open'))tooltip.showPopover();
  anchor.setAttribute('aria-describedby','model-tooltip');anchor.setAttribute('aria-expanded','true');
  positionModelTooltip();
}
$('tour-next').addEventListener('click',()=>moveTour('next'));
$('tour-back').addEventListener('click',()=>moveTour('back'));
$('tour-skip').addEventListener('click',()=>moveTour('skip'));
$('tour-replay').addEventListener('click',()=>showTour(true));
$('model-tooltip').addEventListener('pointerleave',event=>{if(!tooltipPinned&&!tooltipAnchor?.contains(event.relatedTarget)&&document.activeElement!==tooltipAnchor)hideModelTooltip();});
document.addEventListener('pointerdown',event=>{if(tooltipAnchor&&!tooltipAnchor.contains(event.target)&&!$('model-tooltip').contains(event.target))hideModelTooltip();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tooltipAnchor){event.preventDefault();event.stopPropagation();hideModelTooltip();}});
$('panel-ranking').addEventListener('close',hideModelTooltip);
$('panel-ranking').querySelector('.panel-content').addEventListener('scroll',hideModelTooltip);
window.addEventListener('resize',()=>{positionOfficeLabels();hideModelTooltip();});

function openStory(id,replay=false){
  if($('story-dialog').open)return;
  const scene=storyScene(state,id,observedStoryEvents);if(!scene)return;
  pauseForReading();closeDialogs();
  activeStory={scene,index:0,choice:selectedStoryChoice(observedStoryEvents,id),replay};
  renderStory();$('story-dialog').showModal();$('story-title').focus();safeSound('news');
}
function renderStory(){
  if(!activeStory)return;
  const {scene,index,choice,replay}=activeStory;
  $('story-dialog').dataset.mode=scene.mode;$('story-dialog').dataset.sceneId=scene.id;
  $('story-tag').textContent=replay?'办公室片段 · 回看':({dialogue:'办公室对话',choice:'老板，你怎么看',reveal:'翻开看看'})[scene.mode];
  $('story-date').textContent=scene.factsFrozen
    ?`${replay?'回看':''}第 ${scene.day} 日片段 · 记录截至第 ${scene.factDay} 日`
    :replay?`回看第 ${scene.day} 日片段 · 公司数据为当前第 ${state.gameDay} 日`:`第 ${scene.day} 日 · 办公室片段`;
  $('story-title').textContent=scene.title;$('story-intro').textContent=scene.intro;
  ledger($('story-facts'),(scene.facts||[]).map(fact=>[fact.label,fact.value]));$('story-facts').hidden=!scene.facts?.length;
  const options=clear('story-options');let complete=false;
  $('story-card-title').textContent='';$('story-speaker').textContent='';$('story-count').textContent='';
  if(scene.mode==='dialogue'){
    const line=scene.lines[index];$('story-speaker').textContent=line.speaker;$('story-copy').textContent=line.text;
    $('story-count').textContent=`${index+1} / ${scene.lines.length}`;complete=index===scene.lines.length-1;
  }else if(scene.mode==='reveal'){
    const card=scene.cards[index];$('story-card-title').textContent=card.title;$('story-copy').textContent=card.copy;
    $('story-count').textContent=`${index+1} / ${scene.cards.length}`;complete=index===scene.cards.length-1;
    scene.cards.forEach((card,cardIndex)=>{const button=element('button',card.label);button.setAttribute('aria-pressed',String(index===cardIndex));button.addEventListener('click',()=>{activeStory.index=cardIndex;renderStory();});options.append(button);});
  }else{
    const picked=scene.choices.find(item=>item.id===choice);
    $('story-speaker').textContent=picked?'':'请选择';$('story-copy').textContent=picked?picked.reply:'点一个选项，看看接下来发生什么。';complete=!!picked;
    for(const item of scene.choices){
      const button=element('button',item.label);button.dataset.storyChoice=item.id;button.setAttribute('aria-pressed',String(item.id===choice));button.disabled=!!picked||(!replay&&writeBlocked);
      button.addEventListener('click',()=>{
        if(!activeStory||(!activeStory.replay&&writeBlocked))return;
        const previous=[...observedStoryEvents];
        if(!activeStory.replay){observedStoryEvents.push(`story-pick:${scene.id}:${item.id}`);if(!save()&&writeBlocked){observedStoryEvents=previous;return;}}
        activeStory.choice=item.id;renderStory();$('story-next').focus();
      });options.append(button);
    }
  }
  $('story-outro').textContent=scene.outro||'';$('story-outro').hidden=!complete;
  $('story-next').hidden=scene.mode==='choice'&&!complete;
  $('story-next').textContent=complete?'回到办公室':scene.mode==='reveal'?'翻开下一张':'接着听';
  $('story-cta').hidden=!complete||!scene.cta;$('story-cta').textContent=scene.cta?.label||'';
}
$('story-next').addEventListener('click',()=>{
  if(!activeStory)return;
  const {scene,index}=activeStory,steps=scene.mode==='dialogue'?scene.lines:scene.mode==='reveal'?scene.cards:[];
  if(index<steps.length-1){activeStory.index++;renderStory();}else $('story-dialog').close();
});
$('story-skip').addEventListener('click',()=>$('story-dialog').close());
$('story-cta').addEventListener('click',()=>{const panel=activeStory?.scene.cta?.panel;if(!panel)return;$('story-dialog').close();openPanel(panel);});
$('story-dialog').addEventListener('close',()=>{
  const finished=activeStory;activeStory=null;
  if(finished&&!finished.replay&&!writeBlocked&&!observedStoryEvents.includes(finished.scene.id)){observedStoryEvents.push(finished.scene.id);save();}
  render();scheduleAutomaticResume();
});

function renderFeedbackImpact(notice){
  const target=clear('feedback-metrics');target.hidden=notice.kind!=='feedback';if(target.hidden)return;
  const impact=notice.impact;
  if(!impact){const now=marketSummary(state);ledger(target,[['当前活跃用户',now.users.toLocaleString()],['当前付费订阅',now.subscribers.toLocaleString()],['预计订阅收入',`${now.weeklyIncome} 万 / 7 日`],['当前用户评分',ratingLabel(state)]]);return;}
  const {before,after,nextBillIncome}=impact;
  const change=(a,b,suffix='')=>`${a.toLocaleString()} → ${b.toLocaleString()}${suffix}（${b-a>=0?'+':''}${(b-a).toLocaleString()}${suffix}）`;
  ledger(target,[['活跃用户',change(before.users,after.users)],['付费订阅',change(before.subscribers,after.subscribers)],['预计订阅收入',change(before.weeklyIncome,after.weeklyIncome,' 万 / 7 日')],['用户评分',`${before.ratingTenths===null?'暂无评价':(before.ratingTenths/10).toFixed(1)} → ${(after.ratingTenths/10).toFixed(1)} / 5`],['下期预计总收入',`${nextBillIncome} 万（含发布与报道奖励）`]]);
}
function showNextNotification(){
  const next=unreadNotifications(state,observedStoryEvents).find(item=>!isCareer(state)||!['feedback','media','news'].includes(item.kind));
  if(next?.kind==='ready'){openRelease();return true;}
  if(showMilestone())return true;
  if(!next)return false;
  if(next.kind==='story'){openStory(next.id);return true;}
  activeNotification=next;pauseForReading();
  $('notice-category').textContent=({feedback:'用户反馈',media:'媒体报道',farewell:'离职告别',ability:'员工能力',news:'行业快讯'})[next.kind];
  $('notice-icon').textContent=next.kind==='farewell'?'“':next.kind==='media'?'▧':'▤';
  renderFeedbackImpact(next);
  $('notice-date').textContent=`第 ${next.day} 日`;$('notice-title').textContent=next.title;$('notice-copy').textContent=next.copy;
  $('notice-dialog').dataset.kind=next.kind;
  $('notice-next-version').hidden=next.kind!=='feedback';$('notice-open-model').hidden=!next.model;
  $('notice-dialog').showModal();if(next.kind!=='ability')safeSound('news');return true;
}
$('notice-close').addEventListener('click',()=>$('notice-dialog').close());
$('notice-next-version').addEventListener('click',()=>{if(activeNotification?.modelId)feedbackResponses[activeNotification.modelId]='下版处理';$('notice-dialog').close();});
$('notice-open-model').addEventListener('click',()=>{const model=activeNotification?.model;$('notice-dialog').close();if(model)present(model,null,true);});
$('notice-dialog').addEventListener('close',()=>{
  if(activeNotification&&!observedStoryEvents.includes(activeNotification.id)){observedStoryEvents.push(activeNotification.id);save();}
  activeNotification=null;render();scheduleAutomaticResume();
});

function openPlanning(){
  if(!state.project||state.project.status!=='planning')return;
  $('planning-contribution-scores').dataset.scores='';clear('planning-contribution-scores');
  hideTour();closeDialogs();$('planning-scene').hidden=false;setPresentationInert(true);renderPlanning();$('planning-title').focus();
}
function closePlanning(){
  clearTimeout(planningRevealTimer);planningRevealTimer=null;$('planning-scene').hidden=true;setPresentationInert(false);lastFrame=performance.now();scheduleAutomaticResume();
}
function renderPlanningPreview(){
  const project=state.project;if(!project||$('planning-scene').hidden)return;
  const target=project.planScores||proposalScores(state);if(!target)return;
  const ratio=project.planScores?1:Math.min(1,(project.planProgress+dayProgressMs/(RULES.secondsPerDay*1000))/RULES.planningDays);
  const values=target.map((score,index)=>Math.floor((score-project.initialScores[index])*ratio));
  renderScores($('planning-contribution-scores'),values,project.focus);
}
function renderPlanning(){
  if($('planning-scene').hidden)return;
  const project=state.project;if(!project||state.ending){closePlanning();return;}
  const done=!!project.planScores;
  $('planning-title').textContent=project.name;$('planning-person-name').textContent=`${EMPLOYEES[project.plannerId]?.name||'待重新选择'} · 方案负责人`;
  $('planning-stage-title').textContent=done?'方案完成，团队开始研发':'正在设计整体方案';
  $('planning-copy').textContent=done?'方案已交付，下面是三项初始属性。团队接下来开始数据处理。':productionSummary(state).blockedReason||'负责人正在选训练资料、列评测题目，其他同事等方案定下来后开工。';
  $('planning-progress').value=project.planProgress;$('planning-progress-label').textContent=`设计进度 ${project.planProgress} / ${RULES.planningDays} 日`;
  $('planning-result').hidden=!done;if(done)renderScores($('planning-initial-scores'),project.planScores,project.focus);renderPlanningPreview();
  $('planning-time-toggle').textContent=state.paused?'▶ 继续设计':'Ⅱ 暂停';$('planning-time-toggle').disabled=writeBlocked||(project.plannerId===null&&!canWaitForPlanner(state));
  $('planning-speed').value=String(settings.speed);$('planning-day').textContent=`第 ${state.gameDay} 日`;
  if(done&&!planningRevealTimer)planningRevealTimer=setTimeout(closePlanning,1600);
}
$('view-planning').addEventListener('click',openPlanning);$('planning-close').addEventListener('click',closePlanning);
$('planning-settings').addEventListener('click',()=>{closePlanning();$('settings-open').click();});
$('planning-time-toggle').addEventListener('click',toggleTime);
$('planning-speed').addEventListener('change',()=>{settings.speed=Number($('planning-speed').value);saveSettings();$('speed').value=String(settings.speed);});
function showMilestone(){
  if(writeBlocked||storageWriteFailed||state.ending||document.hidden||document.querySelector('dialog[open]'))return false;
  const grants=state.notices.filter(notice=>notice.type==='funding');
  const first=grants[0],top=grants.find(notice=>notice.id==='overall');
  const fundingUnread=first&&!observedStoryEvents.includes('milestone-first-funding');
  const topUnread=top&&!observedStoryEvents.includes('milestone-first-top');
  if(!fundingUnread&&!topUnread)return false;
  const day=fundingUnread?first.day:top.day;
  const champion=topUnread&&top.day===day;
  const ids=[];if(fundingUnread)ids.push('milestone-first-funding');if(champion)ids.push('milestone-first-top');
  const grant=grants.filter(notice=>notice.day===day).reduce((sum,notice)=>sum+notice.amount,0);
  activeMilestone={ids,champion};pauseForReading();
  $('event-title').textContent=champion?'综合榜第一，融资到账':'首笔融资，到账了';
  $('event-copy').textContent=champion?`第 ${day} 日，公司凭综合榜第一获得融资，到账 ${grant} 万。老板忙着截图，小满提醒：“日期别裁掉，隔壁还要发模型。”`:`第 ${day} 日，融资 ${grant} 万到账。投资人刚挂电话，老板就把新机房效果图设成了桌面。小满：“效果图不收电费，设备收。”`;
  drawCelebration($('event-art'),activeMilestone);$('event-dialog').showModal();return true;
}
$('event-close').addEventListener('click',()=>$('event-dialog').close());
$('event-dialog').addEventListener('close',()=>{
  if(activeMilestone){for(const id of activeMilestone.ids)if(!observedStoryEvents.includes(id))observedStoryEvents.push(id);save();}
  activeMilestone=null;scheduleAutomaticResume();
});

$('brand-logo').addEventListener('error',()=>{$('brand-logo').hidden=true;});
$('company-name').value=settings.companyName;
$('company-form').addEventListener('submit',event=>{
  event.preventDefault();if(writeBlocked&&!creatingCompany)return;
  const start=async()=>{newGameConfirmed(newGameOverwrite);const enabled=await audio.enable();settings.sound=enabled;saveSettings();renderAudio();};
  if(newGameOverwrite)showConfirm('开张新公司？','点击开张后会替换当前浏览器中的经营存档。旧版存档保留；返回可继续当前公司。',start,{danger:true,confirmLabel:'开张并替换存档'});else start();
});
$('project-form').addEventListener('submit',event=>{event.preventDefault();if(act({type:'createProject',name:$('model-name').value,focus:$('focus').value,plannerId:selectedPlanner('project-planner'),...(isCareer(state)?{trainingPlan:careerUI.trainingPlan()}:{})},'projectStart')){closeDialogs();act({type:'resume'});openPlanning();}});
$('project-planner').addEventListener('change',updatePlannerSelection);
$('replacement-planner').addEventListener('change',updatePlannerSelection);
$('focus').addEventListener('change',renderPlannerChoices);
$('training-plan').addEventListener('change',updatePlannerSelection);
$('planner-reassignment').addEventListener('submit',event=>{event.preventDefault();if(act({type:'selectPlanner',employeeId:selectedPlanner('replacement-planner')})){closeDialogs();act({type:'resume'});openPlanning();}});
$('time-toggle').addEventListener('click',()=>{toggleTime();if(settings.sound&&!audio.isEnabled())audio.enable().then(renderAudio);});
$('speed').addEventListener('change',()=>{settings.speed=Number($('speed').value);saveSettings();safeSound('ui');});
$('board-direction').addEventListener('change',()=>{renderBoard();safeSound('ui');});
$('buy-compute').addEventListener('click',()=>act({type:'buyCompute',amount:1},'purchase','新设备到位。可用算力增加，运行费也会增加。'));
$('expand-office').addEventListener('click',()=>act({type:'expand'},'purchase','已搬入新的城市总部，八个工位准备就绪。'));
$('reset-quota').addEventListener('click',useResetAbility);
$('open-release').addEventListener('click',openRelease);
$('media').addEventListener('change',releaseCost);
$('cancel-release').addEventListener('click',()=>$('release-dialog').close());
$('release-form').addEventListener('submit',event=>{event.preventDefault();const action={type:'publish',...(isCareer(state)?{policy:careerUI.publicationPolicy(),...(isNextCareer(state)?{issuePolicy:careerUI.issuePolicy()}:{})}:{})};if($('media').value)action.media=$('media').value;const result=act(action);if(result){$('release-dialog').close();const model=state.models.findLast(item=>item.company==='player');present(model,result);}else{$('publish-error').textContent=$('action-message').textContent;}});
$('skip-release').addEventListener('click',finishPresentation);$('release-continue').addEventListener('click',closePresentation);
$('confirm-cancel').addEventListener('click',()=>{$('confirm-dialog').close();confirmAction=null;});
$('confirm-accept').addEventListener('click',()=>{const callback=confirmAction;confirmAction=null;$('confirm-dialog').close();callback?.();});
$('confirm-dialog').addEventListener('cancel',()=>{confirmAction=null;});
$('confirm-dialog').addEventListener('close',()=>{if(!writeBlocked&&!storageWriteFailed&&isCareer(state)&&!state.ending&&(state.career.assessment||pendingProjectDecision(state)))careerUI.renderDecision();});
$('settings-open').addEventListener('click',()=>{if((writeBlocked||storageWriteFailed)&&started){showStorageRecovery();return;}pauseForReading();closeDialogs();$('import-save-status').hidden=true;$('settings-dialog').showModal();});
$('settings-close').addEventListener('click',()=>$('settings-dialog').close());
$('settings-reload-save').addEventListener('click',()=>location.reload());
$('settings-retry-save').addEventListener('click',retryStorageSave);
function downloadSave(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const link=element('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const IMPORT_BACKUP_KEY='ai-dev-story-before-import-v5';
$('export-current-save').addEventListener('click',()=>{if(!started)return;resumeAfterInterruption=false;if(!state.paused)act({type:'pause'});downloadSave(encodeSave(snapshot()),`ai-dev-story-day-${state.gameDay}.json`);});
try{$('export-import-backup').hidden=!localStorage.getItem(IMPORT_BACKUP_KEY);}catch{$('export-import-backup').hidden=true;}
$('export-import-backup').addEventListener('click',()=>{const raw=localStorage.getItem(IMPORT_BACKUP_KEY);if(raw)downloadSave(raw,'ai-dev-story-before-import.json');});
let importReadVersion=0;
$('settings-dialog').addEventListener('close',()=>{importReadVersion++;});
function showImportError(text){
  const status=$('import-save-status');status.textContent=text;status.hidden=false;
  showMessage(text,true);
}
$('import-save-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  const readVersion=++importReadVersion;
  $('import-save-status').hidden=true;
  event.target.value='';
  if(file.size>2_000_000){showImportError('存档文件超过大小限制。');return;}
  let raw;try{raw=await file.text();}catch{if(readVersion===importReadVersion)showImportError('无法读取存档文件。');return;}
  // A newer selection or closing Settings abandons this read, even if the
  // operating system finishes it later. Never replace a newer confirmation.
  if(readVersion!==importReadVersion)return;
  const decoded=decodeSave(raw);if(!decoded.ok){showImportError(decoded.error);return;}
  showConfirm('导入这份公司存档？',`将恢复第 ${decoded.snapshot.state.gameDay} 日的公司，保持暂停。当前浏览器进度将保留为导入前备份。`,()=>{
    const imported=commitImportedSave(localStorage,decoded.snapshot,{expectedRaw:lastKnownRaw,backupKey:IMPORT_BACKUP_KEY});
    if(!imported.ok){
      if(imported.error==='conflict')blockConflictingSave();
      showMessage(imported.error==='invalid'?'导入校验未通过，请保留原文件。':imported.message,true);return;
    }
    creatingCompany=false;newGameOverwrite=false;returnToEnding=false;$('cancel-new-game').hidden=true;
    careerUI.resetDecisionDraft();
    resumeAfterInterruption=false;activeNotification=null;activeStory=null;activeMilestone=null;
    closeDialogs();stopPresentation();stopPresentationAudio();closePlanning();$('release-scene').hidden=true;$('ending-scene').hidden=true;setPresentationInert(false);
    writeBlocked=false;storageProblem='';const restored=restore();flushResearchFeedback();render();
    try{$('export-import-backup').hidden=!localStorage.getItem(IMPORT_BACKUP_KEY);}catch{$('export-import-backup').hidden=true;}
    if(!restored.loaded)showMessage('文件已写入，但重新读取失败。请保留原文件，并检查存档提示。',true);
    else if(!restored.persisted)showMessage('公司已载入，但后续保存失败。经营保持暂停，请导出当前进度。',true);
    else showMessage('存档已校验并导入，当前保持暂停。');
    if(restored.loaded&&state.ending)showEnding();
  },{confirmLabel:'导入存档'});
});

function renderAudio(){$('audio-toggle').textContent=audio.isEnabled()?'关闭全部声音':'开启声音';}
$('audio-toggle').addEventListener('click',async()=>{if(audio.isEnabled()){audio.disable();settings.sound=false;}else settings.sound=await audio.enable();saveSettings();renderAudio();});
$('award-scenes').checked=settings.awardScenes;$('award-scenes').addEventListener('change',()=>{settings.awardScenes=$('award-scenes').checked;saveSettings();});
for(const [id,key,setter]of [['music-volume','music',value=>audio.setMusicVolume(value)],['effects-volume','effects',value=>audio.setEffectsVolume(value)]]){$(id).value=settings[key];$(id).addEventListener('input',()=>{settings[key]=Number($(id).value);setter(settings[key]/100);saveSettings();});}
$('new-game').addEventListener('click',requestNewGame);$('ending-new').addEventListener('click',requestNewGame);$('discard-save').addEventListener('click',requestNewGame);
$('reload-save').addEventListener('click',()=>location.reload());
$('view-ending').addEventListener('click',showEnding);
$('ending-office').addEventListener('click',()=>{$('ending-scene').hidden=true;setPresentationInert(false);render();});
window.addEventListener('storage',event=>{if(event.key!==SAVE_KEY&&event.key!==null)return;blockConflictingSave();});
document.addEventListener('visibilitychange',()=>{audio.setBackgrounded(document.hidden);if(document.hidden){pauseForReading();save();}lastFrame=performance.now();if(!document.hidden)scheduleAutomaticResume();});
window.addEventListener('pagehide',()=>{closingTab=true;pauseForReading();save();});
window.addEventListener('pageshow',()=>{closingTab=false;lastFrame=performance.now();scheduleAutomaticResume();});
function updateDevelopmentScores(){
  if(!state.project)return;
  const target=$('development-attributes'),scores=researchFeedback.scores(state),counters=target.querySelectorAll('.score-cell>strong');
  if(counters.length!==3){renderScores(target,scores,state.project.focus,false);return;}
  target.dataset.scores=scores.join(',')+':'+state.project.focus;
  counters.forEach((counter,index)=>{counter.textContent=String(scores[index]);counter.dataset.target=String(scores[index]);});
}
function renderTimeButton(){
  const playingTail=state.project?.status==='ready'&&researchFeedback.pending&&resumeAfterInterruption;
  const label=state.ending?'本局已结束':state.paused&&!playingTail?'▶ 继续经营':'Ⅱ 暂停';
  if($('time-toggle').textContent!==label)$('time-toggle').textContent=label;
}
function updateDevelopmentProgress(){
  if(!state.project)return;
  const {phaseLabel,phaseTotal,displayProgress}=developmentProgress(state,dayProgressMs);
  const label=`${phaseLabel} · ${Math.floor(displayProgress/(phaseTotal||1)*100)}%`;
  for(const id of ['development-stage','project-stage-label'])if($(id).textContent!==label)$(id).textContent=label;
  for(const id of ['development-progress','research-progress']){$(id).max=phaseTotal||1;$(id).value=displayProgress;}
}
function flushResearchFeedback(){
  researchFeedback.flush();office.clearPoints();updateDevelopmentScores();
}
function tick(now) {
  const elapsed=Math.max(0,now-lastFrame); lastFrame=now;
  audio.setReading(!!document.querySelector('dialog[open]'));
  if(started&&!creatingCompany&&!writeBlocked&&!storageWriteFailed&&!document.hidden&&!closingTab&&!state.ending&&!state.paused){
    const before=state, beforeProgress=dayProgressMs, beforeObserved=[...observedStoryEvents], beforeFeedback=managementFeedback;
    const dayMs=rulesFor(state).secondsPerDay*1000;
    const pacingPoints=!reducedMotion.matches&&(researchFeedback.pending||['planning','researching'].includes(state.project?.status));
    const clockElapsed=pacingPoints?researchFeedback.clockElapsed(elapsed,dayProgressMs,dayMs,settings.speed):elapsed;
    const result=advanceClock(state,dayProgressMs,clockElapsed,settings.speed,(previous,next,action)=>{managementFeedback=captureManagementFeedback(managementFeedback,previous,next,action);});
    state=result.state; dayProgressMs=result.dayProgressMs;
    if(state!==before){
      const hasNews=observeNews(before); save();
      if(writeBlocked)restoreBeforeConflict(before,beforeProgress,beforeObserved,beforeFeedback);
      else {researchFeedback.sync(state,result.presentationEvents,rulesFor(state).secondsPerDay*1000/settings.speed);if(reducedMotion.matches)researchFeedback.flush();render();if(hasNews)safeSound('news');effectsFor(before);scheduleAutomaticResume();}
    } else if(now-lastFractionSave>5000){
      save(); lastFractionSave=now;
      if(writeBlocked)restoreBeforeConflict(before,beforeProgress,beforeObserved,beforeFeedback);
    }
  }
  const wasPending=researchFeedback.pending;
  const pointPlayback=started&&!creatingCompany&&!writeBlocked&&!storageWriteFailed&&!document.hidden&&!closingTab&&!state.ending&&!tourActive&&!document.querySelector('dialog[open]')&&$('planning-scene').hidden&&$('release-scene').hidden&&(!state.paused||(state.project?.status==='ready'&&resumeAfterInterruption));
  if(reducedMotion.matches&&researchFeedback.pending)flushResearchFeedback();
  const points=researchFeedback.advance(elapsed,pointPlayback);
  office.step(elapsed,pointPlayback,{fraction:dayProgressMs/(rulesFor(state).secondsPerDay*1000)});office.showPoints(points);
  if(points.length)updateDevelopmentScores();
  if(wasPending&&!researchFeedback.pending){updateDevelopmentScores();scheduleAutomaticResume();}
  if(pointPlayback&&state.project){
    const hot=$('office').dataset.burstEmployees;
    $('office-caption').textContent=hot?`${hot.split(',').map(id=>EMPLOYEES[id].name).join('、')} 火爆中 · 连续贡献 +1`:researchFeedback.pending?'图标每跳一次，对应属性 +1':state.project.status==='ready'?'研发完成，准备发布':state.project.status==='researching'?'全员自动研发中':state.project.status==='experiment'?'团队正在追加实验':'负责人正在设计方案';
  }
  if(pointPlayback&&!researchFeedback.pending){const discussing=$('office').dataset.discussingEmployees,moving=$('office').dataset.movingEmployees;if(discussing)$('office-caption').textContent=`${discussing.split(',').map(id=>EMPLOYEES[id].name).join(' 和 ')} 正在讨论`;else if(moving)$('office-caption').textContent='同事正在办公室走动';}
  renderTimeButton();
  $('office').dataset.feedbackPending=String(researchFeedback.pending);
  if(!$('planning-scene').hidden)renderPlanningPreview();
  updateDevelopmentProgress();
  const frame=Math.floor(now/240);if(!$('planning-scene').hidden&&frame!==lastPlanFrame){lastPlanFrame=frame;drawPlanning($('planning-art'),{employeeId:state.project?.plannerId||'avery',frame:state.paused?0:frame,done:!!state.project?.planScores,expanded:state.seats===8});}
  $('day-progress').value=dayProgressMs; requestAnimationFrame(tick);
}
restore();render();renderAudio();if(started&&state.ending)showEnding();else if(started&&!settings.tourCompleted)showTour();scheduleAutomaticResume();requestAnimationFrame(tick);
