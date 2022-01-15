var LichatExtensions = ['shirakumo-backfill','shirakumo-data','shirakumo-emote','shirakumo-edit','shirakumo-channel-trees','shirakumo-channel-info','shirakumo-server-management','shirakumo-pause','shirakumo-quiet','shirakumo-ip','shirakumo-bridge','shirakumo-link','shirakumo-markup','shirakumo-user-info','shirakumo-shared-identity','shirakumo-sign','shirakumo-history','shirakumo-block','shirakumo-reactions','shirakumo-replies','shirakumo-last-read','shirakumo-typing'];
(()=>{ let s = cl.intern;
cl.defclass(s('update','lichat'), [s('object','lichat')], {
   'id': cl.requiredArg('id'),
   'clock': null,
   'from': null,
   'signature': null,
});
cl.defclass(s('ping','lichat'), [s('update','lichat')]);
cl.defclass(s('pong','lichat'), [s('update','lichat')]);
cl.defclass(s('connect','lichat'), [s('update','lichat')], {
   'password': null,
   'version': cl.requiredArg('version'),
   'extensions': cl.requiredArg('extensions'),
});
cl.defclass(s('disconnect','lichat'), [s('update','lichat')]);
cl.defclass(s('register','lichat'), [s('update','lichat')], {
   'password': cl.requiredArg('password'),
});
cl.defclass(s('channel-update','lichat'), [s('update','lichat')], {
   'channel': cl.requiredArg('channel'),
   'bridge': null,
});
cl.defclass(s('target-update','lichat'), [s('update','lichat')], {
   'target': cl.requiredArg('target'),
});
cl.defclass(s('text-update','lichat'), [s('update','lichat')], {
   'text': cl.requiredArg('text'),
   'rich': null,
   'markup': null,
});
cl.defclass(s('join','lichat'), [s('channel-update','lichat')]);
cl.defclass(s('leave','lichat'), [s('channel-update','lichat')]);
cl.defclass(s('message','lichat'), [s('channel-update','lichat'),s('text-update','lichat')], {
   'link': null,
   'reply-to': null,
});
cl.defclass(s('create','lichat'), [s('object','lichat')], {
   'channel': null,
});
cl.defclass(s('kick','lichat'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('pull','lichat'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('permissions','lichat'), [s('channel-update','lichat')], {
   'permissions': null,
});
cl.defclass(s('grant','lichat'), [s('channel-update','lichat'),s('target-update','lichat')], {
   'update': cl.requiredArg('update'),
});
cl.defclass(s('deny','lichat'), [s('channel-update','lichat'),s('target-update','lichat')], {
   'update': cl.requiredArg('update'),
});
cl.defclass(s('users','lichat'), [s('channel-update','lichat')], {
   'users': null,
});
cl.defclass(s('channels','lichat'), [s('channel-update','lichat')], {
   'channels': null,
   'channel': null,
});
cl.defclass(s('user-info','lichat'), [s('target-update','lichat')], {
   'registered': null,
   'connections': null,
   'info': null,
});
cl.defclass(s('capabilities','lichat'), [s('channel-update','lichat')], {
   'permitted': null,
});
cl.defclass(s('server-info','lichat'), [s('target-update','lichat')], {
   'attributes': cl.requiredArg('attributes'),
   'connections': cl.requiredArg('connections'),
});
cl.defclass(s('failure','lichat'), [s('text-update','lichat')]);
cl.defclass(s('malformed-update','lichat'), [s('failure','lichat')]);
cl.defclass(s('update-too-long','lichat'), [s('failure','lichat')]);
cl.defclass(s('connection-unstable','lichat'), [s('failure','lichat')]);
cl.defclass(s('too-many-connections','lichat'), [s('failure','lichat')]);
cl.defclass(s('update-failure','lichat'), [s('failure','lichat')], {
   'update-id': cl.requiredArg('update-id'),
});
cl.defclass(s('invalid-update','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('already-connected','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('username-mismatch','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('incompatible-version','lichat'), [s('update-failure','lichat')], {
   'compatible-versions': cl.requiredArg('compatible-versions'),
});
cl.defclass(s('invalid-password','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-profile','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('username-taken','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-channel','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('registration-rejected','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('already-in-channel','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('not-in-channel','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('channelname-taken','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('too-many-channels','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('bad-name','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('insufficient-permissions','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('invalid-permissions','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-user','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('too-many-updates','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('clock-skewed','lichat'), [s('update-failure','lichat')]);
cl.defclass(s('backfill','shirakumo'), [s('channel-update','lichat')], {
   'since': null,
});
cl.defclass(s('data','shirakumo'), [s('channel-update','lichat')], {
   'content-type': cl.requiredArg('content-type'),
   'filename': null,
   'payload': cl.requiredArg('payload'),
});
cl.defclass(s('bad-content-type','shirakumo'), [s('update-failure','lichat')], {
   'allowed-content-types': cl.requiredArg('allowed-content-types'),
});
cl.defclass(s('emotes','shirakumo'), [s('channel-update','lichat')], {
   'names': null,
});
cl.defclass(s('emote','shirakumo'), [s('channel-update','lichat')], {
   'content-type': cl.requiredArg('content-type'),
   'name': cl.requiredArg('name'),
   'payload': cl.requiredArg('payload'),
});
cl.defclass(s('emote-list-full','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('edit','shirakumo'), [s('message','lichat')]);
cl.defclass(s('no-such-parent-channel','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('channel-info','shirakumo'), [s('channel-update','lichat')], {
   'keys': cl.requiredArg('keys'),
});
cl.defclass(s('set-channel-info','shirakumo'), [s('channel-update','lichat'),s('text-update','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('no-such-channel-info','shirakumo'), [s('update-failure','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('malformed-channel-info','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('kill','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('destroy','shirakumo'), [s('channel-update','lichat')]);
cl.defclass(s('ban','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('unban','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('blacklist','shirakumo'), [s('update','lichat')], {
   'target': null,
});
cl.defclass(s('pause','shirakumo'), [s('channel-update','lichat')], {
   'by': cl.requiredArg('by'),
});
cl.defclass(s('quiet','shirakumo'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('unquiet','shirakumo'), [s('channel-update','lichat'),s('target-update','lichat')]);
cl.defclass(s('quieted','shirakumo'), [s('channel-update','lichat')], {
   'target': null,
});
cl.defclass(s('ip-ban','shirakumo'), [s('update','lichat')], {
   'ip': cl.requiredArg('ip'),
   'mask': cl.requiredArg('mask'),
});
cl.defclass(s('ip-unban','shirakumo'), [s('update','lichat')], {
   'ip': cl.requiredArg('ip'),
   'mask': cl.requiredArg('mask'),
});
cl.defclass(s('ip-blacklist','shirakumo'), [s('update','lichat')], {
   'target': null,
});
cl.defclass(s('bad-ip-format','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('bridge','shirakumo'), [s('channel-update','lichat')]);
cl.defclass(s('set-user-info','shirakumo'), [s('text-update','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('malformed-user-info','shirakumo'), [s('update-failure','lichat')]);
cl.defclass(s('no-such-user-info','shirakumo'), [s('update-failure','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('share-identity','shirakumo'), [s('update','lichat')], {
   'key': null,
});
cl.defclass(s('unshare-identity','shirakumo'), [s('update','lichat')], {
   'key': null,
});
cl.defclass(s('list-shared-identities','shirakumo'), [s('update','lichat')], {
   'identities': null,
});
cl.defclass(s('assume-identity','shirakumo'), [s('target-update','lichat')], {
   'key': cl.requiredArg('key'),
});
cl.defclass(s('search','shirakumo'), [s('channel-update','lichat')], {
   'results': null,
   'offset': null,
   'query': null,
});
cl.defclass(s('block','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('unblock','shirakumo'), [s('target-update','lichat')]);
cl.defclass(s('blocked','shirakumo'), [s('update','lichat')], {
   'target': null,
});
cl.defclass(s('react','shirakumo'), [s('channel-update','lichat')], {
   'target': cl.requiredArg('target'),
   'update-id': cl.requiredArg('update-id'),
   'emote': cl.requiredArg('emote'),
});
cl.defclass(s('last-read','shirakumo'), [s('channel-update','lichat')], {
   'target': null,
   'update-id': null,
});
cl.defclass(s('typing','shirakumo'), [s('channel-update','lichat')]);
})();
