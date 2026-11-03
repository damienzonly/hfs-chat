const assert = require('node:assert/strict')
const test = require('node:test')

test('validates anonymous nicknames and discards them for authenticated users', async () => {
    let username
    let stored
    let notified
    const chatDb = {
        put(_, value) { stored = value },
        size: () => 0,
    }
    const throttleDb = { async get() {}, put() {} }
    const api = {
        Const: { API_URI: '/~/api/' },
        openDb: async name => name === 'chat' ? chatDb : throttleDb,
        require: name => name === './auth' ? { getCurrentUsername: () => username } : require(name),
        getConfig: key => ({ anonWrite: true, maxMsgLen: 280, spamTimeout: 0, retainMessages: 1000 })[key],
        notifyClient(_, __, value) { notified = value },
    }
    const { middleware } = await require('../dist/plugin.js').init(api)

    for (const n of [{}, 'x'.repeat(51)]) {
        const ctx = {
            path: '/~/api/chat/add', method: 'POST', ip: '127.0.0.1',
            state: { params: { m: 'hello', n } }, stop() {},
        }
        await middleware(ctx)
        assert.equal(ctx.status, 400)
    }
    assert.equal(stored, undefined)

    username = 'alice'
    const ctx = {
        path: '/~/api/chat/add', method: 'POST', ip: '127.0.0.1',
        state: { params: { m: 'hello', n: 'x'.repeat(1000) } }, stop() {},
    }
    await middleware(ctx)
    assert.equal(ctx.status, 201)
    assert.equal(stored.n, undefined)
    assert.equal(notified.n, undefined)
})

test('prefixes every chat request with the HFS mount path', async () => {
    const urls = []
    let form
    let renderFooter
    global.fetch = async url => {
        urls.push(url)
        return { status: 201, json: async () => ({}) }
    }
    global.localStorage = {}
    global.MutationObserver = class { observe() {} disconnect() {} }
    global.window = { ResizeObserver: undefined }
    global.document = { body: {}, getElementById: () => null, querySelector: () => null }
    global.requestAnimationFrame = () => 1
    global.cancelAnimationFrame = () => {}
    const effects = []
    let stateCall = 0
    global.HFS = {
        prefixUrl: '/mount',
        getPluginConfig: () => ({ anonRead: true, anonWrite: true, maxMsgLen: 280, spamTimeout: 0 }),
        state: {},
        React: {
            Fragment: 'fragment',
            useState: init => [stateCall++ === 0
                ? { username: undefined, isBanned: false }
                : typeof init === 'function' ? init() : init === true ? false : init === '' ? 'hello' : init, () => {}],
            useEffect: effect => effects.push(effect),
            useRef: () => ({ current: null }),
        },
        h(type, props, ...children) {
            if (typeof type === 'function') return type(props || {})
            if (type === 'form') form = props
            return { type, props, children }
        },
        onEvent: (_, callback) => renderFooter = callback,
        useSnapState: () => ({}),
        getNotifications: async () => ({ close() {} }),
        _: { map: () => [] },
        misc: {
            tryJson: () => false,
            useStateMounted: init => [init, () => {}, () => init],
        },
        iconBtn: () => null,
        domOn: () => () => {},
        dialogLib: {},
        t: value => value,
        toast() {},
    }
    delete require.cache[require.resolve('../dist/public/main.js')]

    try {
        require('../dist/public/main.js')
        renderFooter()
        for (const effect of effects.splice(0)) effect()
        for (const effect of effects.splice(0)) effect()
        await form.onSubmit({ preventDefault() {} })
        await new Promise(setImmediate)
        assert.deepEqual(urls, [
            '/mount/~/api/chat/banned',
            '/mount/~/api/chat/list',
            '/mount/~/api/chat/add',
        ])
    }
    finally {
        delete global.HFS
        delete global.fetch
        delete global.localStorage
        delete global.MutationObserver
        delete global.window
        delete global.document
        delete global.requestAnimationFrame
        delete global.cancelAnimationFrame
    }
})

test('updates chat visibility when the session username changes', () => {
    let renderFooter
    let username = ''
    global.localStorage = {}
    global.HFS = {
        state: {},
        getPluginConfig: () => ({ anonRead: false, anonWrite: false }),
        React: {
            Fragment: 'fragment',
            useEffect() {},
            useRef: () => ({ current: null }),
            useState: () => [{ username, isBanned: false }, () => {}],
        },
        h(type, props) {
            if (typeof type !== 'function') return { type, props }
            return type.name === 'ChatContainer' ? { type: type.name } : type(props || {})
        },
        onEvent: (_, callback) => renderFooter = callback,
        useSnapState: () => ({ username }),
    }
    delete require.cache[require.resolve('../dist/public/main.js')]

    try {
        require('../dist/public/main.js')
        assert.equal(renderFooter(), null)
        username = 'alice'
        assert.equal(renderFooter().type, 'ChatContainer')
        username = ''
        assert.equal(renderFooter(), null)
    }
    finally {
        delete global.HFS
        delete global.localStorage
    }
})

test('ignores an outdated ban response after the username changes', async () => {
    const requests = []
    const updates = []
    let effect
    let renderFooter
    let username = 'alice'
    global.fetch = () => new Promise(resolve => requests.push(resolve))
    global.localStorage = {}
    global.HFS = {
        prefixUrl: '',
        getPluginConfig: () => ({ anonRead: false, anonWrite: false }),
        React: {
            Fragment: 'fragment',
            useEffect: callback => effect = callback,
            useRef: () => ({ current: null }),
            useState: () => [undefined, value => updates.push(value)],
        },
        h(type, props) {
            if (typeof type !== 'function') return { type, props }
            return type.name === 'ChatContainer' ? { type: type.name } : type(props || {})
        },
        onEvent: (_, callback) => renderFooter = callback,
        useSnapState: () => ({ username }),
    }
    delete require.cache[require.resolve('../dist/public/main.js')]

    try {
        require('../dist/public/main.js')
        renderFooter()
        const discardAlice = effect()
        username = 'bob'
        renderFooter()
        discardAlice()
        effect()
        requests[1]({ json: async () => true })
        await new Promise(setImmediate)
        requests[0]({ json: async () => false })
        await new Promise(setImmediate)
        assert.deepEqual(updates, [{ username: 'bob', isBanned: true }])
    }
    finally {
        delete global.HFS
        delete global.fetch
        delete global.localStorage
    }
})
