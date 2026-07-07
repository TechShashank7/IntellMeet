import { StreamClient } from "@stream-io/node-sdk";
const client = new StreamClient("abc", "def");
console.log(Object.keys(client));
let proto = Object.getPrototypeOf(client);
while(proto) {
  console.log(Object.getOwnPropertyNames(proto));
  proto = Object.getPrototypeOf(proto);
}
