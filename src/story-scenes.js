import {
  campaignDay, rulesFor, price, rank, total,
  productionSummary, board,
} from './game/rules.js';
import {finaleDay} from './story.js';
import {nextBillPreview} from './management-feedback.js';

export const STORY_SCENES = [
  { id: 'story-bill', classicDay: 7, replaces: ['bill-first'], mode: 'dialogue', title: '工资表已经发来了' },
  { id: 'story-contacts', classicDay: 24, replaces: ['N17'], mode: 'reveal', title: 'Jeff 发了封告别邮件' },
  { id: 'story-headlines', classicDay: 44, replaces: ['headlines'], mode: 'choice', title: '给昨天的稿子换个标题' },
  { id: 'story-prices', classicDay: 60, replaces: ['N22'], mode: 'reveal', title: '股票跌了，显卡能便宜吗' },
  { id: 'story-pencil', classicDay: 78, replaces: ['rival-0-2'], mode: 'dialogue', title: '这张榜单图怎么裁' },
  { id: 'story-doors', classicDay: 94, replaces: ['N20'], mode: 'choice', title: '试用要申请，简历直接收' },
  { id: 'story-soon', classicDay: 111, replaces: ['countdown'], mode: 'reveal', title: '两家都在问对面几点发' },
  { id: 'story-verification', classicDay: 128, replaces: ['N16'], mode: 'choice', title: '到底要打多快' },
  { id: 'story-steady', classicDay: 140, replaces: ['N01-sale'], mode: 'dialogue', title: '销售又发来一张机房效果图' },
  { id: 'story-deadline', classicDay: 161, replaces: ['deadline'], mode: 'choice', title: '这款还能赶上吗' },
];

// These short scenes use append-only business records, not calendar promises.
// Separate windows keep their first appearances apart and clear of assessments.
export const CAREER_STORY_SCENES = [
  {id:'story-old-model',from:119,until:161,mode:'dialogue',title:'账单上怎么还是旧型号',replaces:[]},
  {id:'story-open-followup',from:168,until:217,mode:'dialogue',title:'同行的附件里写了我们',replaces:[]},
  {id:'story-version-notes',from:168,until:217,mode:'dialogue',title:'这次到底改了什么',replaces:[]},
  {id:'story-award-followup',from:252,until:308,mode:'dialogue',title:'这一届，名单写了什么',replaces:[]},
];

export function careerStoryStartMarker(day) { return `story-career-v1-start:${day}`; }
export function versionNotesStartMarker(day) { return `story-version-notes-start:${day}`; }
function careerSceneSource(state, definition, observedIds) {
  if(!['career336','career336v2','career336v3'].includes(state.campaignProfile))return null;
  const prefix=definition.id==='story-version-notes'?'story-version-notes-start:':'story-career-v1-start:';
  const marker=observedIds.find(id=>id.startsWith(prefix)&&/^\d+$/.test(id.slice(prefix.length)));
  if(!marker)return null;
  const enabled=Number(marker.slice(prefix.length));
  const inWindow=day=>day>=Math.max(enabled,definition.from)&&day<=definition.until&&day<state.gameDay;
  if(definition.id==='story-old-model'){
    for(const bill of state.bills){
      if(!inWindow(bill.day)||!(bill.subscriptionSource?.income>0))continue;
      const model=state.models.find(item=>item.company==='player'&&item.id===bill.subscriptionSource.modelId);
      if(!model)continue;
      // A publication later on the same billing day must not retroactively
      // turn that morning's latest model into an older-model income story.
      const newer=state.models.filter(item=>item.company==='player'&&item.sequence>model.sequence&&item.day<bill.day).at(-1);
      if(newer)return {day:bill.day,sourceKey:`bill:${bill.day}`,bill,model,newer};
    }
  }else if(definition.id==='story-open-followup'){
    for(const model of state.models){
      if(model.company==='player'||!inWindow(model.day)||!model.learningBonus?.some(value=>value>0))continue;
      const source=state.models.find(item=>item.company==='player'&&item.id===model.learningSourceId);
      if(source)return {day:model.day,sourceKey:`learning:${model.id}`,model,source};
    }
  }else if(definition.id==='story-version-notes'){
    // A new name is not proof of progress; only compare actual publications.
    for(const model of state.models){
      if(model.company!=='player'||!inWindow(model.day))continue;
      const previous=state.models.filter(item=>item.company==='player'&&item.sequence<model.sequence).at(-1);
      if(previous)return {day:model.day,sourceKey:`versions:${previous.id}:${model.id}`,model,previous};
    }
  }else{
    const award=state.career.awards?.find(item=>inWindow(item.day)&&item.results.length>0);
    if(award)return {day:award.day,sourceKey:`award:${award.day}`,award};
  }
  return null;
}

function careerStoryScene(state, definition, observedIds) {
  const source=careerSceneSource(state,definition,observedIds);
  if(!source)return null;
  const result={...definition,day:source.day+1,factDay:source.day,factsFrozen:true,sourceKey:source.sourceKey};
  if(definition.id==='story-version-notes'){
    const {model,previous}=source,deltas=model.scores.map((value,index)=>value-previous.scores[index]);
    const comparison=['编程','办公','多模态'].map((label,index)=>`${label} ${deltas[index]>=0?'+':''}${deltas[index]}`).join(' / ');
    return {...result,
      intro:`小满把 ${model.name} 和 ${previous.name} 的评测表并排打开。老板先看了看两个版本号。`,
      lines:[
        {speaker:'老板',text:'新型号又发了。这次到底哪儿变了？'},
        {speaker:'小满',text:`和 ${previous.name} 相比：${comparison}。分项都在这，别只抄总分。`},
        {speaker:'老板',text:deltas.some(value=>value>0)?'那把变化写前面。名字挤不下就小一号，别把旧成绩那列删了。':'“全面升级”先别写。新旧结果都留着，型号后缀替不了分数。'},
      ],
      facts:[
        {label:'上一代型号',value:`${previous.name} · 第 ${previous.day} 日发布 · ${previous.scores.join(' / ')}`},
        {label:'本次型号',value:`${model.name} · 第 ${model.day} 日发布 · ${model.scores.join(' / ')}`},
        {label:'实际成绩变化',value:comparison},
      ],
      outro:'小满保存了两列成绩。老板把“前代”改成了完整型号名。',
      cta:{label:'查看型号研发履历',panel:'project'},
    };
  }
  if(definition.id==='story-old-model'){
    const {bill,model,newer}=source,subscription=bill.subscriptionSource;
    const rankLabel=subscription.direction===null?'综合': ['编程','办公','多模态'][subscription.direction];
    return {...result,
      intro:`小满把第 ${bill.day} 日的账单递过来。桌面上还开着 ${newer.name} 的发布稿，收款依据却写着 ${model.name}。`,
      lines:[
        {speaker:'老板',text:'型号是不是填旧了？我们不是又发了一款吗？'},
        {speaker:'小满',text:`没填错。这笔订阅收入还是 ${model.name} 挣的。您看，型号和发布日都对得上。`},
        {speaker:'老板',text:'那发布稿归新款，这笔钱先谢老款。旧页面留着，别一发新版就找不着了。'},
      ],
      facts:[
        {label:'本次账单',value:`第 ${bill.day} 日`},
        {label:'基础订阅来源',value:`${model.name} · 第 ${model.day} 日发布`},
        {label:'当期基础订阅',value:`${cash(subscription.income)} · ${rankLabel}参考第 ${subscription.referenceRank} 名`},
        {label:'当时已有更新型号',value:`${newer.name} · 第 ${newer.day} 日发布`},
        {label:'当期全部收入',value:`${cash(bill.income)}（含基础订阅及当期其他收入）`},
      ],
      outro:'老板把旧型号的资料页重新拖回了书签栏。',
      cta:{label:'查看资金账目',panel:'finance'},
    };
  }
  if(definition.id==='story-open-followup'){
    const {model,source:opened}=source;
    return {...result,
      intro:`${model.company} 发布了 ${model.name}。小满翻到工程资料的后面，指着一行来源：${opened.name}。`,
      lines:[
        {speaker:'老板',text:'这行是咱们的？再往上翻翻，他们拿它做了哪款？'},
        {speaker:'小满',text:`${model.name}，参考的就是 ${opened.name}。他们的成绩我也放旁边了，您一起看。`},
        {speaker:'老板',text:'想转发，又有点不想转发了。先看看他们这款的成绩。'},
      ],
      facts:[
        {label:'公开来源',value:`${opened.name} · 第 ${opened.openDay} 日开放`},
        {label:'实际采用型号',value:`${model.company} ${model.name} · 第 ${model.day} 日发布`},
        {label:'该代实际吸收',value:`编程 +${model.learningBonus[0]} / 办公 +${model.learningBonus[1]} / 多模态 +${model.learningBonus[2]}`},
        {label:'该代公开成绩',value:`编程 ${model.scores[0]} / 办公 ${model.scores[1]} / 多模态 ${model.scores[2]}`},
      ],
      outro:'老板点开转发框，先没按发送。',
      cta:{label:'查看型号资料',panel:'ranking'},
    };
  }
  const {award}=source,won=award.results.filter(item=>item.company==='player');
  return {...result,
    intro:won.length?`第 ${award.day/28} 届评选名单公布。小满把 ${won.map(item=>`${item.name}（${item.category}）`).join('、')} 标了出来。`:`第 ${award.day/28} 届评选名单公布。老板在页面里搜了几遍公司名字。`,
    lines:won.length?[
      {speaker:'老板',text:'名单里有咱们？哪一行，让我再看一眼。'},
      {speaker:'小满',text:`名单和型号都核过了。${award.cash?'奖金也已经入账。':'是开放贡献奖。这项没奖金，别往收入表里填。'}`},
      {speaker:'老板',text:'这张我要存好。调试截图翻多了，也该留点高兴的。'},
    ]:[
      {speaker:'老板',text:'是不是搜索坏了？'},
      {speaker:'小满',text:'没坏。这届没有我们的，获奖型号在下面。'},
      {speaker:'老板',text:'行，别换拼音再搜了。这页留着，下回看看差在哪。'},
    ],
    facts:[
      {label:'本次评选',value:`第 ${award.day/28} 届 · 第 ${award.day} 日`},
      {label:'当届获奖名单',value:award.results.map(item=>`${item.category}：${item.company==='player'?'本公司':item.company} ${item.name}`).join('；')},
      {label:'本公司本届结果',value:won.length?won.map(item=>`${item.category} · ${item.name}`).join('；'):'未获奖'},
      {label:'本届已结算奖励',value:`奖金 ${cash(award.cash)} · 关注 +${award.fans}`},
    ],
    outro:won.length?'老板保存名单时，把文件名里的“有望”删了。':'小满存好这届名单，老板把搜索框里的公司名字删掉了。',
    cta:{label:'查看研发履历',panel:'project'},
  };
}

const owned = state => state.models.filter(model => model.company === 'player');
const cash = amount => `${amount} 万`;
const signedCash = amount => `${amount >= 0 ? '+' : ''}${amount} 万`;
const rankText = state => rank(state) === null ? '尚未发布' : `综合榜第 ${rank(state)} 名`;
const historicalModel = (state, company, day) => state.models
  .filter(model => model.company === company && model.day <= day)
  .sort((a, b) => b.day - a.day || b.sequence - a.sequence)[0];
const modelCopy = model => model
  ? `${model.name}：编程 ${model.scores[0]}，办公 ${model.scores[1]}，多模态 ${model.scores[2]}。`
  : '当时还没有已发布的型号。';
const currentFacts = state => [
  { label: '你公司的已发布模型', value: `${owned(state).length} 款` },
  { label: '你公司的综合排名', value: rankText(state) },
];

export function storyScene(state, id, observedIds = []) {
  const careerDefinition=CAREER_STORY_SCENES.find(scene=>scene.id===id);
  if(careerDefinition)return careerStoryScene(state,careerDefinition,observedIds);
  const meta = STORY_SCENES.find(scene => scene.id === id);
  if (!meta) return null;
  const day = meta.id==='story-deadline'?finaleDay(state,meta.classicDay):campaignDay(state, meta.classicDay);
  const result = { ...meta, day, intro: '', facts: [], outro: '' };
  const published = owned(state);
  const bills = state.bills;

  if (id === 'story-bill') {
    const bill=nextBillPreview(state);
    Object.assign(result, {
      intro: '老板的屏幕上开着融资演示稿。小满把工资表拖到旁边，两个窗口正好挡住了那条向上的曲线。',
      lines: [
        { speaker: '小满', text: state.ending?'这是最后留下的账目，工资、设备费都在里面。':'工资表来了。设备和上线支持的费用也列在这一张，得一起付。' },
        { speaker: '老板', text: state.ending?'演示稿也留下吧。下次开公司，至少不用重画曲线。':'那我演示稿里这笔收入呢？' },
        { speaker: '小满', text: state.ending?'可以，账单也一起留着。':published.length?'已经发出的型号，我算进去了。下一款还没挣到的钱，先别填。':'模型还没发布呢。先用账上的钱付，曲线我给您留着。' },
      ],
      facts: [
        { label: '公司现金', value: cash(state.cash) },
        ...(!state.ending?[{label:'下次结账',value:`第 ${bill.day} 日`}]:[]),
        { label: '每期工资、设备运行及支持费', value: cash(bill.salaries + bill.running + bill.support) },
        { label: state.ending ? '公司状态' : '预计下期收支净额（当前条件）', value: state.ending ? '已结束经营' : signedCash(bill.net) },
        ...(!state.ending?[{label:'预算口径',value:'按当前排名和安排估算；未发布的新收入还没算进去。'}]:[]),
      ],
      outro: state.ending?'小满把两份文件放进同一个文件夹。':`小满把“第 ${bill.day} 日”圈起来。老板将增长曲线的窗口缩小了一点。`,
      cta: { label: '打开资金账目', panel: 'finance' },
    });
  } else if (id === 'story-contacts') {
    const model = historicalModel(state, 'Gloglo', day);
    Object.assign(result, {
      intro: 'Gloglo 的首席科学家 Jeff Damn 发来告别邮件。这家千人以上的公司，祝福还没刷完，下一场评审的邀请又到了。',
      cards: [
        { label: '读告别邮件', title: 'Jeff Damn 离开 Gloglo', copy: 'Jeff：“谢谢大家。接下来做什么，想好了再告诉你们。”同事刚回了“常联系”，日历就弹出提醒：明天下午，模型评审。' },
        { label: '看看模型页面', title: model?.name || '当时的模型页面', copy: `${modelCopy(model)} 产品组在群里问：“评审谁主持？”研发回复：“先把会议室留着，人我们来找。”` },
      ],
      facts: [{ label: '你公司的员工人数', value: `${state.employees.length} 人` },{label:'行业公司规模',value:'Jeff 离职后，Gloglo 仍有上千名员工。'}],
      outro: state.employees.length===0?'老板看了一眼空工位：“我们得先找一个能开会的人。”':state.employees.length === 2 ? '老板：“咱们研发请假一个，就少一半。候选人名单拿来看看。”' : `老板：“咱们现在 ${state.employees.length} 个人，下款最缺哪种本事？”`,
      cta: { label: '看看我们能招谁', panel: 'hiring' },
    });
  } else if (id === 'story-headlines') {
    Object.assign(result, {
      intro: '新智猿编辑部。同行的新模型预告挂了三天，编辑打开稿子：“标题还不够急。你帮我挑一个词？”',
      choices: [
        { id: 'sudden', label: '填“突然”', reply: '编辑：“好，突然发布！”实习生：“那三篇预热稿呢？”编辑：“留着，放延伸阅读。”' },
        { id: 'again', label: '填“又”', reply: '编辑：“又来了！用昨天那版。”实习生：“型号也用昨天的吗？”编辑：“这个得改。”' },
        { id: 'epic', label: '填“史诗级”', reply: '编辑：“史诗级！配张成绩图。”实习生：“测试还没跑完。”编辑：“那先把图的位置空着。”' },
      ],
      facts: [{ label: '你公司已购买的报道', value: `${published.filter(model => model.media).length} 篇` }],
      outro: '稿件存好，编辑又往工作群补了一句：“别发错了，这是今天的。”',
    });
  } else if (id === 'story-prices') {
    Object.assign(result, {
      intro: 'DeepPeek R1 的价目表传到了同行群里。有人圈出费用那一行，又转来 Nvidya 的股票页面。',
      cards: [
        { label: '读股票新闻', title: 'Nvidya 的股价跌了', copy: '同行老板把 R1 的价格页转给工程师：“咱们能不能也卖这个价？”工程师：“您先把我们这月的机器账单发我。”' },
        { label: '看供应商的报价单', title: '显卡报价没跟着跌', copy: `当日报价，每单位 ${cash(price({ ...state, gameDay: day }))}。采购把股价截图发给销售：“这个跌了，咱那单呢？”销售回了一张原报价单：“这张没变。”` },
      ],
      facts: [
        { label: '你公司现在的采购单价', value: `${cash(price(state))} / 单位` },
        { label: '你公司已购算力', value: `${state.compute} 单位` },
      ],
      outro: '采购撤回了“趁跌抄底”四个字，重新问了一遍交货时间。',
      cta: { label: '查看设备报价', panel: 'finance' },
    });
  } else if (id === 'story-pencil') {
    const cloud = historicalModel(state, 'AntiThropic', day);
    const talk = historicalModel(state, 'CloseAI', day);
    const currentRank=rank(state);
    Object.assign(result, {
      intro: '小满把两份新成绩排在一张图里。老板拉宽窗口，右边又露出几列。',
      lines: [
        { speaker: '小满', text: `${cloud?.name || 'Cloud 的已发布型号'} 和 ${talk?.name || 'TalkGPT 的已发布型号'} 都发了。两家的成绩在这儿。` },
        { speaker: '老板', text: currentRank===1?'咱们排第一？那整张都放上。':currentRank===null?'咱们那一行呢？':'只截我们擅长的那一列，能不能好看点？' },
        { speaker: '小满', text: currentRank===1?'好，日期也带着。下次回看知道是哪天的。':currentRank===null?'我们还没有模型上榜。先把这一张留着，首发以后再加。':'能。列名也得留着，别把单项写成综合第一。' },
      ],
      facts: currentFacts(state),
      outro: currentRank===1?'老板把带日期的整张图存了下来。':currentRank===null?'老板关掉了海报模板，点回研发页。':`老板：“行，第 ${currentRank} 名也先留一份。下次拿它比。”`,
      cta: { label: '打开完整榜单', panel: 'ranking' },
    });
  } else if (id === 'story-doors') {
    Object.assign(result, {
      intro: 'Meeta 的托管 API 试用页弹出“请联系商务”。隔壁招聘页不用登录，邮箱和电话都写在第一屏。',
      choices: [
        { id: 'download', label: '申请托管 API 试用', reply: '访客：“权重我能下载，不过想先试试你们托管的 API。”商务：“请填公司、用途和预计用量，审核后联系您。”访客：“试用额度也得先谈一轮？”' },
        { id: 'talent', label: '点一下招聘入口', reply: '候选人：“我只是点进来看看。”招聘负责人：“没关系，先聊聊。今天几点方便？待遇可以电话说。”' },
      ],
      facts: [{ label: '你公司的员工人数', value: `${state.employees.length} 人` }],
      outro: 'API 试用页还停在申请表，招聘页已经弹出“现在方便聊聊吗”。',
      cta: { label: '查看我们的招聘名单', panel: 'hiring' },
    });
  } else if (id === 'story-soon') {
    Object.assign(result, {
      intro: '两家都写了“很快”。编辑打开排期表，给 CloseAI 和 AntiThropic 各打了一个电话。',
      cards: [
        { label: '读 CloseAI 的回信', title: '“对面定了吗？”', copy: 'CloseAI 公关：“AntiThropic 定几点？”编辑：“还没说。”公关：“那您问到了告诉我一声。”' },
        { label: '读 AntiThropic 的回信', title: '“他们发了就打给我”', copy: '五分钟后，AntiThropic 公关打来：“CloseAI 定了吗？”编辑：“我也正等他们电话。”' },
      ],
      facts: [{ label: '你公司的已发布模型', value: `${published.length} 款` }],
      outro: '编辑打开两个直播间，先把外卖点了。',
    });
  } else if (id === 'story-verification') {
    Object.assign(result, {
      intro: '开发者想把一行报错发给 Cloud。页面先拦住他：“请证明您不是自动程序。”',
      choices: [
        { id: 'fast', label: '直接贴上报错', reply: '页面：“输入速度异常，请重新验证。”开发者：“我就复制了一行报错，还没点发送呢。”' },
        { id: 'slow', label: '一个字一个字打', reply: '页面：“操作节奏异常，请重新验证。”开发者：“我一字一字敲的啊。您还想怎么个敲法？”' },
      ],
      facts: [],
      outro: '他点开申诉页。页面说：请先登录。',
    });
  } else if (id === 'story-steady') {
    const lastBill = bills.at(-1);
    Object.assign(result, {
      intro: `Nvidya 的促销邮件又来了：当日报价每单位 ${cash(price({ ...state, gameDay: day }))}，到第 ${campaignDay(state, 147)} 日结束。附件里还放了一张扩建机房的效果图。`,
      lines: [
        { speaker: 'Nvidya 销售', text: '图上还给您留了扩建的位置。这批有优惠，要不要顺便多订几台？' },
        { speaker: '老板', text: '那电费和运行费也按优惠价算？' },
        { speaker: '小满', text: lastBill?'设备是这次买，运行费是每期付。上次的账单我放旁边了，您一起看。':'设备是这次买，运行费是每期付。第一张账单还没来，这笔也得留。' },
      ],
      facts: [
        { label: '现在的设备采购单价', value: `${cash(price(state))} / 单位` },
        { label: '你公司最近的账单', value: lastBill ? `第 ${lastBill.day} 日，收入 ${cash(lastBill.income)}，工资和运行费 ${cash(lastBill.salaries + lastBill.running)}${lastBill.support?`，支持费 ${cash(lastBill.support)}`:''}` : '还没有账单' },
      ],
      outro: '销售又把效果图往前推了推，小满把账单压在它旁边。',
      cta: { label: '看看最近的账单', panel: 'finance' },
    });
  } else if (id === 'story-deadline') {
    const deadline = rulesFor(state).lastDay - 1;
    const summary = productionSummary(state);
    const best = board(state).find(model => model.company === 'player');
    let progress;
    if (state.ending) progress = '这家公司已经结算完了。模型和账单都留着，没发的不能补进成绩。';
    else if (!state.project) progress = published.length?'现在没有在研模型。手上这些成绩先留好；要开新款，得看剩下的时间够不够。':'现在没有在研模型，也还没有首发。先到研发页看看报价和工期，别把发布那一步漏了。';
    else if (state.project.status === 'ready') progress = `${state.project.name} 已完成，还差正式发布。发布费 ${cash(rulesFor(state).publicationCost)}，之前的训练费不用再付。`;
    else if (summary.blockedReason) progress = `项目现在停着：${summary.blockedReason}。先处理这一项，再看能不能赶上。`;
    else if (summary.estimatedDays === null) progress = `${state.project.name} 正在${summary.phaseLabel}，当前进度 ${summary.phaseProgress} / ${summary.phaseTotal}。后面的安排还没定，暂时无法给出完整完成日。先把这一步看清楚，再决定要不要追加。`;
    else {
      const completion = state.gameDay + summary.estimatedDays;
      progress = `照现在的人手和算力，${state.project.name} 预计第 ${completion} 日做完。${completion > deadline ? '晚于发布截止日，赶不上这期了。' : '预计来得及。做完后记得正式发布。'}`;
    }
    const again = observedIds.includes('story-pick:story-headlines:again');
    Object.assign(result, {
      intro: state.ending?`小满把日历夹进报告：“这家公司的经营已经结束了。原定发布截止是第 ${deadline} 日，实际发过什么都在这里。”`:`小满在日历上圈出第 ${deadline} 日：“这是最后能发布的一天。第 ${rulesFor(state).lastDay} 日结账，没发的模型不算成绩。”`,
      choices: [
        { id: 'progress', label: '看在研项目的进度', reply: progress },
        { id: 'record', label: '看我们已经发了什么', reply: best ? `我们发过 ${published.length} 款模型。综合榜上是 ${best.name}，${total(best)} 分，${rankText(state)}。` : '我们尚未发布模型，报告里还没有成绩。' },
      ],
      facts: [
        { label: '公司现金', value: cash(state.cash) },
        { label: '最后可发布日期', value: `第 ${deadline} 日` },
      ],
      outro: state.ending?'小满把报告放好：“都收在这里了，随时能回来查。”':again ? '小满翻出你上次选的“又”：“模板倒是还能用。日期和型号，这次记得换。”' : '小满拿起笔：“您先看，我等发布记录。”',
      cta: { label: '打开模型项目', panel: 'project' },
    });
  }
  return result;
}

// Reading progress belongs to this company; it never enters the economic reducer.
export function storyStartMarker(day) { return `story-start:${day}`; }
export function reachedStoryScenes(state,observedIds=[]) {
  const marker=observedIds.find(id=>/^story-start:\d+$/.test(id));
  const startDay=marker?Number(marker.slice('story-start:'.length)):state.gameDay+1;
  const calendar=STORY_SCENES.map(scene=>({...scene,day:scene.id==='story-deadline'?finaleDay(state,scene.classicDay):campaignDay(state,scene.classicDay)})).filter(scene=>scene.day>=startDay&&scene.day<=state.gameDay);
  const career=CAREER_STORY_SCENES.map(scene=>careerStoryScene(state,scene,observedIds)).filter(Boolean);
  return [...calendar,...career].sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
}
export function selectedStoryChoice(observedIds,sceneId) {
  const prefix=`story-pick:${sceneId}:`;
  const marker=observedIds.find(id=>id.startsWith(prefix));
  return marker?marker.slice(prefix.length):null;
}
