interface User {
  name: string;
  age: number;
}

function greet(user: User): void {
  if (user.age >= 18) {
    console.log(`Hello, ${user.name}!`);
  } else {
    console.log(`Hi, little ${user.name}.`);
  }
}

const users: User[] = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 12 },
];

users.forEach((u) => greet(u));
