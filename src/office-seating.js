// Company presentation metadata. Never reorder the economic employee list.
export function validOfficeSeating(value,state){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const entries=Object.entries(value);
  return entries.length<=state.employees.length&&entries.every(([id,seat])=>state.employees.includes(id)&&Number.isInteger(seat)&&seat>=0&&seat<state.seats)&&new Set(entries.map(([,seat])=>seat)).size===entries.length;
}
export function officeSeatOccupants(state,seating=state.officeSeating??{}){
  const seats=Array(state.seats??4).fill(null),placed=new Set();
  for(const id of state.employees){const seat=seating?.[id];if(Number.isInteger(seat)&&seat>=0&&seat<seats.length&&seats[seat]===null){seats[seat]=id;placed.add(id);}}
  for(const id of state.employees)if(!placed.has(id)){const seat=seats.indexOf(null);if(seat>=0)seats[seat]=id;}
  return seats;
}
export const officeSeatAssignments=(state,seating)=>Object.fromEntries(officeSeatOccupants(state,seating).flatMap((id,seat)=>id?[[id,seat]]:[]));
export const employeeSeatIndex=(state,id)=>officeSeatOccupants(state).indexOf(id);
export function moveOfficeSeat(state,seating,employeeId,seat){
  if(!state.employees.includes(employeeId))throw new Error('employee');
  if(!Number.isInteger(seat)||seat<0||seat>=state.seats)throw new Error('seat');
  const occupants=officeSeatOccupants(state,seating),from=occupants.indexOf(employeeId),other=occupants[seat];
  occupants[seat]=employeeId;occupants[from]=other;
  return Object.fromEntries(occupants.flatMap((id,index)=>id?[[id,index]]:[]));
}
