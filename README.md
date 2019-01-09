# GFtheme (Template generation system for GAFAfit)

## Requirements

For development, you will only need Node.js installed on your environment.

### Node

[Node](http://nodejs.org/) is really easy to install & now include [NPM](https://npmjs.org/).
You should be able to run the following command after the installation procedure
below.

    $ node --version
    v0.10.24

    $ npm --version
    1.3.21

#### Node installation on OS X

You will need to use a Terminal. On OS X, you can find the default terminal in
`/Applications/Utilities/Terminal.app`.

Please install [Homebrew](http://brew.sh/) if it's not already done with the following command.

    $ ruby -e "$(curl -fsSL https://raw.github.com/Homebrew/homebrew/go/install)"

If everything when fine, you should run

    brew install node

#### Node installation on Linux

    sudo apt-get install python-software-properties
    sudo add-apt-repository ppa:chris-lea/node.js
    sudo apt-get update
    sudo apt-get install nodejs

#### Node installation on Windows

Just go on [official Node.js website](http://nodejs.org/) & grab the installer.
Also, be sure to have `git` available in your PATH, `npm` might need it.

---

## Install

    $ git clone https://github.com/GafaMX/GFtheme.git
    $ cd GFtheme
    $ npm install

## Start dev server with hot reloading & watch

    $ npm start

## Simple build for production

    $ npm run build

## Update sources

Some packages usages might change so you should run `npm prune` & `npm install` often.
A common way to update is by doing

    $ git pull
    $ npm prune
    $ npm install

To run those 3 commands you can just do

    $ npm run pull

**Note:** Unix user can just link the `git-hooks/post-merge`:

## Usage

The main goal of GFtheme is to render individual components into HTML tag containers, using shortcodes data attributes 
for containers declared inside your body tag. The shortcode attribute name will always be data-gf-theme.

#### GafaFitSDK library
GFtheme uses the GafaFitSDK API library, so you must need to include it in your main HTML file code just before close 
the body tag, like this:

    ...
    <script src="https://gafa.fit/sdk/dist/main.js"></script>
    </body>
    ...

#### GAFAfit Buy/Reserve fancy
To render the Buy/Reserve fancy is necessary declare a container with the data-gf-theme equals to fancy:

    ...
    <section data-gf-theme="fancy"></section>
    ...

Inside this container will be rendered the fancy to Buy or Reserve. If there's no declared, then you'll never see the fancy.

#### Render components

For other components you must use different shortcode names for the data-gf-theme attribute.

For example:

    ...
    <section data-gf-theme="combo-list"></section>
    ...

This will render a combo list inside this container.

Is important include always the open and close tags, don't do it using only the same tag to open and close.

It means, never use this:

    ...
    <section data-gf-theme="combo-list" />
    ...
    
Always use it this way:

    ...
    <section data-gf-theme="combo-list"></section>
    ...
    
#### Shortcodes list

The current list of available components to be rendered are:

* `combo-list`  Combo list
* `staff-list`   Staff list
* `service-list`   Services list
* `membership-list`   Memberships list

* `login`   Login
* `register`   Register
* `password-recovery`   Password recovery
* `profile-info`   Profile basic info (Under development)

