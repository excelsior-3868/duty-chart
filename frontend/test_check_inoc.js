import axios from 'axios';

async function checkInoc() {
  const query = await axios.get('http://localhost:8000/api/duties/?date=2026-03-01', {
     headers: { Authorization: "Bearer x9m8AmzfF91RhNo5HMQbX4nRHulE1ykZ2eUKT6A_a9E" }
  })
  console.log(query.data);
}
checkInoc()
