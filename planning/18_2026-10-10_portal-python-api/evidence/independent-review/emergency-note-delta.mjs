import {readFileSync} from 'node:fs';
const root=new URL('../../../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');let pass=0,fail=0;
function check(name,ok){console.log(`${ok?'PASS':'FAIL'} ${name}`);ok?pass++:fail++;}
const source=read('portal/src/components/python-dashboard.tsx');const engine=read('src/maintenance/engine.py');
const contract=engine.split('    def emergency_close(')[1].split('    def set_priority(')[0];
check('frozen Python emergency_close note_required',contract.includes('note_required=True'));
const valid=s=>s.includes('<NoteAction label="Đã xử lý khẩn cấp" required ');
check('UI emergency-close required aligns contract',valid(source));
check('optionalnote mutant RED',!valid(source.replace('<NoteAction label="Đã xử lý khẩn cấp" required ','<NoteAction label="Đã xử lý khẩn cấp" ')));
const note=source.split('function NoteAction(')[1].split('function ManagementPanel(')[0];
check('required forwarded textarea',note.includes('required={required}'));
check('empty and whitespace note disable submit',note.includes('required && !note.trim()'));
check('nonempty note submitted to frozen action',source.includes('action("emergency-close", { note }'));
console.log(`TOTAL=${pass+fail} PASS=${pass} FAIL=${fail} SKIP=0`);process.exitCode=fail?1:0;
