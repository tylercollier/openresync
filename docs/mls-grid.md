# MLS Grid

I designed this app to be flexible because I didn't know how others would want to use it. I'm but one fish in this pond and am not sure how "normal" my use is. Therefore, some things are not done for you, and you are expected to do them yourself. And for the average user, there will probably be more to do when syncing from MLS Grid compared to the other platforms.

Here I'll explain some considerations regarding MLS Grid. I consider them "special" considerations because most of my experience is with Trestle, and so I found MLS Grid's way of doing things unexpected. This is not to say MLS Grid is "doing it wrong". They might not even be different compared to most platforms out there; it's just different than my experience with Trestle.

A mission of this project is to make these considerations more public. Hopefully you don't have to learn these the hard way like I did.

This is not an exhaustive list. Again, it's more from my point of view of what was different than I was used to. Consult with the [MLS Grid API documentation](https://docs.mlsgrid.com/api-documentation/api-version-2.0) for more.

## Endpoint

In each request, you are expected to have a query string parameter of `OriginatingSystemName`, including to request metadata. Similarly you are expected to have a `MlgCanView` query string parameter in each request (except metadata).

Thus, in your OpenReSync `config/config.js` file, for each source, you'll want to specify the `metadataEndpoint` value as something like:

> The following URL is not URL-encoded for URL readability. OpenReSync will automatically URL-encode the URLs you give it.

`https://api.mlsgrid.com/v2/Property?$filter=OriginatingSystemName eq 'realtrac' and MlgCanView eq true`

## Purge and MlgCanView

MLS Grid has a concept of MlgCanView, where records you can access have an `MlgCanView` value of `true`, and they set records they have recently deleted (or removed from your account) to have an `MlgCanView` value of `false`. This is a good idea from the perspective of efficiency. Similar to syncing, you don't have to sync all data or even reconcile what the MLS has to what you have. Instead, you just say "tell me what's been removed since the last time I removed stuff at [SOME TIMESTAMP]".

The problem with this approach is it doesn't help if there might've been a mistake at any point in the past, and you have a record that wasn't properly purged. I suppose you could run two different kinds of purges: 1) the "what's been removed since [SOME TIMESTAMP]" method, and 2) for safety, and thus perhaps less often, a "what's been removed since the beginning of time", to ensure you haven't missed any.

To keep the code consistent for all platforms for now, OpenReSync employs the same purge strategy for MLS Grid as for other platforms: download all IDs from the MLS, and compare to all IDs in the destinations, and remove extras from destinations. Thus, because it takes longer, you probably won't want to schedule purges to run as frequently as your syncs.

## Lookups

Lookups are not in the metadata. They are a resource, just like `Property`. This might actually be a good thing for you. OpenReSync does not sync lookups from metadata, but OpenReSync is able to sync any resource, so it can sync lookups from MLS Grid. Use the `Lookup` (singular) resource.

## Usage limits

Be aware that MLS Grid imposes usage limits, such as a cap on requests per hour, megabytes downloaded per hour, and so on. Without any additional configuration, you might come up against these limits, especially if you are performing an initial sync. Currently there is nothing that prevents exceeding these limits because it is difficult to prevent it perfectly without being overly cautious (i.e., slow). You must modify the code yourself to do so. You might presumably put some kind of `sleep()` concept in `lib/sync/downloader.js`. After an initial sync, you theoretically won't encounter such usage limits though.

## JSON values

Be advised that MLS Grid uses JSON arrays for their fields with lookup values, as opposed to stringifying them with a comma delimiter. For example, if a Property record has an Appliances field with a value of "Washer,Dryer,Refrigerator", MLS Grid would have it as a JSON array like `['Washer', 'Dryer', 'Refrigerator']`. This might be fine for you. Remember that if you wish to change the value, such as mimicking the behavior of Trestle, you may do so in the `transform()` method in each destination's config section. You can see an example of the idea in the `config.example.js`'s MLS Grid example, in the `destinations` subsection for MySQL.
