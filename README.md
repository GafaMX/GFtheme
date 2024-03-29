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
for containers declared inside your body tag.

For example: You can set rendering shortcodes in containers using data-gf-theme attribute.

#### GafaFitSDK library

GFtheme uses the GafaFitSDK API library, so you must need to include it in your main HTML file code just before close
the body tag, like this:

    ...
    <script src="https://gafa.fit/sdk/dist/main.js"></script>
    </body>
    ...

#### Recaptcha v3 library

GFtheme uses the Recaptcha v3 library, so you must need to include it in your main HTML file code just before close
the body tag and the GafaFitSDK API library, like this:

    ...
    <script src="https://www.google.com/recaptcha/api.js?render=[YOUR RECAPTCHA PUBLIC KEY]"></script>
    <script src="https://gafa.fit/sdk/dist/main.js"></script>
    </body>
    ...

You can obtain [YOUR RECAPTCHA PUBLIC KEY] by contacting technical support.

#### GafaFitThemeSDK configuration options

GFtheme needs a basic configuration options to work, by now we'll use a JSON object definition for that purposes, the
configuration options properties are: GAFA_FIT_URL, COMPANY_ID, API_CLIENT, API_SECRET.

For example you can use this definition before include the GafaFitThemeSDK main script:

    ...
    <script type="text/javascript" src="https://cdn.conekta.io/js/latest/conekta.js"></script>
    <script src="https://www.google.com/recaptcha/api.js?render=[YOUR RECAPTCHA PUBLIC KEY]"></script>
    <script src="[SYSTEM URL]/sdk/dist/main.js"></script>
    <script data-gf-options type="application/json">
        {
            "GAFA_FIT_URL": "[SYSTEM URL]",
            "COMPANY_ID": 1,
            "API_CLIENT": 1,
            "API_SECRET": "[YOUR BUQ API SECRET KEY]",
            "TOKENMOVIL": null,
            "CAPTCHA_SECRET_KEY": "[YOUR RECAPTCHA SECRET KEY]",
            "CAPTCHA_PUBLIC_KEY": "[YOUR RECAPTCHA PUBLIC KEY]",
            "REMOTE_ADDR": "127.0.0.1"
            "CONEKTA_PUBLIC_KEY":  "[YOUR CONEKTA PUBLIC KEY]",
        }
    </script>
    </body>
    ...

You can obtain [YOUR RECAPTCHA PUBLIC KEY], [YOUR RECAPTCHA SECRET KEY] and [YOUR BUQ API SECRET KEY] by contacting
technical support.

#### GafaFitThemeSDK library for testing purposes

If you want to use this templates SDK embedded in your website for testing purposes you can include the built version
of the script in your site just between the GafaFitSDK library script and close the body tag, like this:

    ...
    <script type="text/javascript" src="https://cdn.conekta.io/js/latest/conekta.js"></script>
    <script src="https://www.google.com/recaptcha/api.js?render=[YOUR RECAPTCHA PUBLIC KEY]"></script>
    <script src="[SYSTEM URL]/sdk/dist/main.js"></script>
    <script data-gf-options type="application/json">
        {
            "GAFA_FIT_URL": "[SYSTEM URL]",
            "COMPANY_ID": 1,
            "API_CLIENT": 1,
            "API_SECRET": "[YOUR BUQ API SECRET KEY]",
            "TOKENMOVIL": null,
            "CAPTCHA_SECRET_KEY": "[YOUR RECAPTCHA SECRET KEY]",
            "CAPTCHA_PUBLIC_KEY": "[YOUR RECAPTCHA PUBLIC KEY]",
            "REMOTE_ADDR": "127.0.0.1"
            "CONEKTA_PUBLIC_KEY":  "[YOUR CONEKTA PUBLIC KEY]",
        }
    </script>
    <script src="https://dev.gafa.codes/GFtheme/dist/main.js"></script>
    </body>
    ...

#### GAFAfit Buy/Reserve fancy

To render the Buy/Reserve fancy is necessary declare a container with the data-gf-theme equals to fancy:

    ...
    <section data-gf-theme="fancy"></section>
    ...

Inside this container will be rendered the fancy to Buy or Reserve. If there's no declared, then you'll never see the
fancy.

#### Render components

For other components you must use different shortcode names for the data-gf-theme attribute.

For example:

    ...
    <section data-gf-theme="combo-list"></section>
    ...

This will render a combo list inside this container.

Is important include always the open and close tags, don't do it using only the same tag to open and close.

It means, NEVER DO THIS:

    ...
    <section data-gf-theme="combo-list" />
    ...

ALWAYS USE IT THIS WAY:

    ...
    <section data-gf-theme="combo-list"></section>
    ...

#### Shortcodes list

##### Rendering shortcode

The first and most important short code is the rendering one, for this you must use the data-gf-theme attribute in
your html containers.

The current list of available components to be rendered are:

* `combo-list`  Combo list. Options
    * `data-gf-filterbyname` Filters combos to only show the ones where
      the name matches the text in this field.
    * `data-buq-brand` Filters combos to only show the ones where
      the brand name matches the text in this field.
* `staff-list`   Staff list
* `service-list`   Services list
* `membership-list`   Memberships list. Options:
    * `data-gf-filterbyname` Filters combos to only show the ones where
      the name matches the text in this field.
    * `data-buq-brand` Filters combos to only show the ones where
      the brand name matches the text in this field.
* `meetings-calendar`  Calendar of Meetings. Options:
    * `data-bq-calendar-visualization` Can be 'horizontal' or 'vertical' (default 'horizontal').
      Horizontal calendar presents one day at a time and can also be changed by week.
      Vertical calendar presents one week at a time and can change weeks. Both look the
      same in mobile screens.
    * `filter-bq-brand` Allows filtering the calendar by brand.
    * `filter-bq-location` Allows filtering the calendar by location.
    * `filter-bq-staff` Allows filtering the calendar by staff.
    * `filter-bq-service` Allows filtering the calendar by service.
    * `filter-bq-room` Allows filtering the calendar by room.
    * `filter-bq-brand-default` If filtering is active, it selects and filters by a
      particular brand when the calendar initializes.
    * `filter-bq-service-default` If filtering is active, it selects and filters by a
      particular service when the calendar initializes.
    * `filter-bq-location-default` If filtering is active, it selects and filters by a
      particular location when the calendar initializes.
    * `filter-bq-staff-default` If filtering is active, it selects and filters by a
      particular staff when the calendar initializes.
    * `filter-bq-room-default` If filtering is active, it selects and filters by a
      particular room when the calendar initializes.
    * `data-bq-show-description` Shows the extra information in the meeting
    * `data-bq-block-after-login` Prevents opening the purchase window after user
      logs in. This should only be used when there's a compatibility issue with the
      styles of the web page the calendar is on.
    * `data-bq-partial-loading` Changes the loading of meetings so it loads by room instead 
      of loading by location. Use if there's a lot of meetings to load.

* `login-register`   Login/Register component, when is clicked open up a dialog with the options. Ideal for app menu.
  If the user is logged in, the component shows the user name with the available credits, when click open a dialog with
  the user info.

* `login`   Login
* `register`   Register
* `password-recovery`   Password recovery
* `profile-info`   Profile basic info
* `purchase-button` Purchase Button component. When given this data attribute to an
  external button it links it with the purchase window to open it with a particular
  item in the cart when clicked. Necessary information:
    * `data-bq-location-id` location where the purchase will be made (if left blank it will take the first location
      available)
    * `data-bq-combo-id` Id of the Combo to add to the cart (required if
      membership id not defined)
    * `data-bq-membership-id` Id of the membership to add
      to the cart (required if combo id not defined)
    * `data-bq-no-loading` if true no
      loading animation will be shown when clicking the button.
* `calendar-filter-button` External html that filters the calendar when clicked.
  Options:
    * `data-bq-calendar-filter-type` The filter that will be used. The accepted values
      are: `staff`, `services`, `brands`, `locations`, `rooms`
    * `data-bq-calendar-filter-id` The id of the specific element that will be filtered
    * `data-bq-no-scroll` Optional. When present, prevents scrolling to the position
      of the calendar

#### New Features

New features added to shortcodes:

* `locations-filter`   Brand location selector

<!-- ##### Pagination shortcode

There are lists that can be paginated, these are:

* `combo-list`  Combo list
* `staff-list`   Staff list
* `service-list`   Services list
* `membership-list`   Memberships list

In this case there is an attribute to set the quantity of elements per page wanted, the attribute is data-gf-perpage.

For example, if you use:
    
    ...
    <section data-gf-theme="staff-list" data-gf-perpage="4"></section>
    ...
    
You will render the staff list paginated with 4 elements per page, otherwise, it'll be used the default per page 
value of 10. -->