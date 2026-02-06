import axios from "axios";

export const api = axios.create({
  baseURL: "https://nonforbearingly-unretaining-jannie.ngrok-free.dev/",
  timeout: 30000,
});

