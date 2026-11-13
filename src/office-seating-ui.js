import {EMPLOYEES} from './game/content.js';
import {officeSeatOccupants,moveOfficeSeat} from './office-seating.js';
const option=(value,text)=>{const n=document.createElement('option');n.value=value;n.textContent=text;return n;};
export function createOfficeSeatingUI({getState,getSeating,commit,office,canvas,isLocked}){
  const dialog=document.getElementById('panel-seating'),employee=document.getElementById('seating-employee'),target=document.getElementById('seating-target'),apply=document.getElementById('seating-apply'),help=document.getElementById('seating-help'),pins=document.getElementById('seating-pins'),preview=document.getElementById('seating-preview');
  let signature='',lastSeats=[];
  function describe(){
    const s=getState(),seats=officeSeatOccupants(s,getSeating()),to=Number(target.value),from=seats.indexOf(employee.value),other=seats[to];
    if(from<0){apply.disabled=true;help.textContent='当前没有可调整的员工，请先招聘。';return;}
    apply.disabled=isLocked()||from===to;apply.textContent=other&&other!==employee.value?'交换工位':'移动到空工位';
    help.textContent=from===to?'这位员工已经在这个工位。':other?`${EMPLOYEES[employee.value]?.name} 与 ${EMPLOYEES[other].name} 交换工位，确认后自动保存。`:`${EMPLOYEES[employee.value]?.name} 移至 ${to+1} 号空工位，确认后自动保存。`;
    for(const button of pins.children)button.setAttribute('aria-pressed',String(Number(button.dataset.seat)===to));
  }
  function render(force=false){
    document.getElementById('seating-open').disabled=isLocked()||canvas.dataset.ready!=='true';
    if(!dialog.open)return;
    const s=getState(),seats=officeSeatOccupants(s,getSeating()),layout=office.getSeatLayout(),next=JSON.stringify([seats,layout,isLocked()]);
    if(!force&&next===signature)return;signature=next;
    const selected=employee.value,selectedTarget=target.value;
    employee.replaceChildren(...s.employees.map(id=>option(id,`${EMPLOYEES[id].name} · ${seats.indexOf(id)+1}号工位`)));
    if(s.employees.includes(selected))employee.value=selected;
    target.replaceChildren(...seats.map((id,i)=>option(i,`${i+1}号 · ${id?EMPLOYEES[id].name:'空工位'}`)));
    if(selectedTarget!==''&&Number(selectedTarget)<seats.length)target.value=selectedTarget;
    else target.value=String(seats.indexOf(employee.value));
    preview.width=canvas.width;preview.height=canvas.height;preview.getContext('2d').drawImage(canvas,0,0);
    pins.replaceChildren();lastSeats=seats;
    for(const {index,point}of layout){
      const button=document.createElement('button');button.type='button';button.dataset.seat=index;button.className='seat-pin';
      button.textContent=String(index+1);button.style.left=`${point[0]/canvas.width*100}%`;button.style.top=`${point[1]/canvas.height*100}%`;
      button.setAttribute('aria-label',`${index+1}号工位：${seats[index]?EMPLOYEES[seats[index]].name:'空位'}`);
      button.addEventListener('click',()=>{target.value=String(index);describe();});pins.append(button);
    }
    describe();
  }
  employee.addEventListener('change',()=>{target.value=String(lastSeats.indexOf(employee.value));describe();});target.addEventListener('change',describe);
  document.getElementById('seating-form').addEventListener('submit',event=>{event.preventDefault();if(apply.disabled)return;const next=moveOfficeSeat(getState(),getSeating(),employee.value,Number(target.value));if(commit(next)){render(true);help.textContent='工位已调整并保存。';}});
  canvas.addEventListener('office-layout',()=>render());
  return {render};
}
