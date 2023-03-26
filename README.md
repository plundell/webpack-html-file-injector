# webpack-html-file-injector
A simple webpack loader plugin which replaces a tag in an html file with the contents of another html file. This enables the creating a single large index.html file from multiple component.html files. So if you have these 3 files:

#### **`src/index.html`**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Website</title>
</head>
<body>
  <webpack-inject src='./nav.html' />
  <webpack-inject src='./main.html' />
</body>
</html>
``` 

#### **`src/nav.html`**
```html
<div id='navbar'>
  <div>Home</div>
</div>
```

#### **`src/main.html`**
```html
<h1>Welcome</h1>
<p>Let's build a great website</p>
```

You can output this file:

#### **`dist/index.html`**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Website</title>
</head>
<body>
  <div id='navbar'>
    <div>Home</div>
  </div>
  <h1>Welcome</h1>
  <p>Let's build a great website</p>
</body>
</html>
``` 
