function sayHello(content) {
  if (!content) {
    console.log("...");
  } else if (typeof content !== "string") {
    console.log(":rage:");
  } else {
    console.log(content);
  }
}

sayHello();
sayHello(1);
sayHello("Hi");

const obj = {
  foo: "bar",
  hoge: "fuga",
};

const arrow = () => {
  console.log(obj);
};

[1, 2, 3].forEach((element) => {
  console.log(element);
});
