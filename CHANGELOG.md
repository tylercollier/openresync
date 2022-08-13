# CHANGELOG

**0.4.0**

* Features
  * Added support for RMLS (Portland) MLS
* Bug fixes
  * Don't assume there's a response in errors from axios
* General improvements
  * Downloads are generally more resilient, retrying 3 times, whether the response is non-200 (as in, not successful), or if the response is invalid JSON
  * Move more responsibilities into the platform adapters so that functionality can be different for each platform
  * The directory `config/user` is ignored by git, so you can put any files in there that you want, such as JavaScript files that you `require()` from your `config/config.js`.
* User config API
  * Minor version bump from 0.3.0 to 0.4.0
  * For the MySQL destination, the `transform()` function now has a `cache` parameter, just like the Solr destination. This allows you to more efficiently do lookups, etc, because you won't lose those lookups between calls to `transform`. For more, see where `transform()` is mentioned in [config.example.js](config/config.example.js).

**OLDER**

For older releases, the authoritative source is the source code.
