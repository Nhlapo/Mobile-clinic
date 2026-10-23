import {openDb,hash} from './db.js';
const [email,password,name='Morjud administrator']=process.argv.slice(2);
if(!email?.includes('@')||!password||password.length<12){console.error('Usage: npm run admin -- email password "Full name" (minimum 12-character password)');process.exit(1);}
const db=openDb();
db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin') ON CONFLICT(email) DO UPDATE SET role='admin',password=excluded.password").run(name,email.toLowerCase(),hash(password));
console.log('Administrator account is ready. Log in through the website.');db.close();
