---

title: Front matter is skipped

# not a heading

---

# Title

<!-- toc -->
<!-- tocstop -->

## Real heading

```bash
# install dependencies
npm install
## not a heading either
```

```
# tilde fence
```

````markdown
```
# nested fence
```
## still inside
````

- A list item with code:

  ```sh
  # comment in a list
  ```

<!--
## commented-out heading
-->

    # indented code is not a heading

## After the code

```js
// an unclosed fence hides the rest of the file
# never seen
```
