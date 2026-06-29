import axios from 'axios';

async function checkInoc() {
  const query = await axios.get('http://localhost:8001/api/offices/');
  console.log(query.data.find(o => o.name.includes("INOC")));
}
checkInoc()
