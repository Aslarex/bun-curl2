import Http from "../src/services/http";


// DEFAULT METHOD is always GET

const req = await Http("https://www.example.com");

console.log(req);