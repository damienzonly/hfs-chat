"use strict";
{
  const conf = HFS.getPluginConfig();
  const { username } = HFS.state; // NB: this can change at run-time
  const { h } = HFS;
  const { useState, useEffect, useRef, Fragment } = HFS.React;

  HFS.onEvent("footer", () => h(ChatApp));

  let { anonRead: anonCanRead, anonWrite: anonCanWrite } = conf;
  if (username) {
    anonCanRead = true;
    anonCanWrite = true;
  }

  function ChatMessage({ message, previousMessage, nextMessage }) {
    const { u, m, ts, n } = message;
    const { username: currentUsername } = HFS.useSnapState();
    const isCurrentUser = u === currentUsername;
    const displayName = u || (n && `${n}`) || "Anonymous";

    const showDateSeparator = shouldShowDateSeparator(ts, previousMessage?.ts);
    const showSender =
      !isCurrentUser && shouldShowSender(message, previousMessage);
    const isConsecutive = isConsecutiveMessage(message, previousMessage);

    return h(
      Fragment,
      {},
      showDateSeparator &&
        h(
          "div",
          { className: "date-separator" },
          h(
            "span",
            {},
            new Date(ts).toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          )
        ),
      h(
        "div",
        {
          className: `msg ${isCurrentUser ? "msg-user" : "msg-anon"} ${
            isConsecutive ? "consecutive" : ""
          }`,
        },
        showSender && h("div", { className: "msg-sender" }, displayName),
        h(
          "div",
          { className: "msg-bubble" },
          h("div", { className: "msg-content" }, m),
          h(
            "div",
            { className: "msg-meta" },
            h(
              "div",
              { className: "msg-ts" },
              new Date(ts).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            )
          )
        )
      )
    );

    function shouldShowDateSeparator(currentTs, previousTs) {
      if (!previousTs) return true;
      const currentDate = new Date(currentTs);
      const previousDate = new Date(previousTs);
      return currentDate.toDateString() !== previousDate.toDateString();
    }

    function shouldShowSender(currentMsg, prevMsg) {
      if (!prevMsg) return true;
      if (currentMsg.u !== prevMsg.u) return true;
      if (currentMsg.n !== prevMsg.n) return true;
      return false;
    }

    function isConsecutiveMessage(currentMsg, prevMsg) {
      if (!prevMsg) return false;
      if (currentMsg.u !== prevMsg.u) return false;
      if (currentMsg.n !== prevMsg.n) return false;
      return true;
    }
  }

  function httpCodeToast(status) {
    const msg = {
      403: "Forbidden",
      400: "Invalid Request",
      429: `Can only send one message every ${conf.spamTimeout} seconds`,
    }[status];
    msg && HFS.toast(msg, "error");
  }

  const ChatIcon = () =>
    h(
      "svg",
      {
        className: "chat-icon",
        viewBox: "0 0 24 24",
        width: "20",
        height: "20",
      },
      [
        h("path", {
          fill: "currentColor",
          d: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z",
        }),
      ]
    );

  const SendIcon = () =>
    h(
      "svg",
      {
        className: "send-icon",
        viewBox: "0 0 24 24",
        width: "18",
        height: "18",
      },
      [
        h("path", {
          fill: "currentColor",
          d: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
        }),
      ]
    );

  function ChatContainer() {
    const { username } = HFS.useSnapState();
    const [m, sm] = useState("");
    const [n, sn] = useState(
      () =>
        (localStorage.chatNick ||= "U" + Math.random().toString().slice(2, 5))
    );
    useEffect(() => {
      localStorage.chatNick = n;
    }, [n]);

    let [collapsed, setCollapsed, getCollapsed] = HFS.misc.useStateMounted(
      HFS.misc.tryJson(localStorage.chatCollapsed) ?? true
    );
    const getCollapsedValue = getCollapsed.get || getCollapsed;
    useEffect(() => {
      localStorage.chatCollapsed = JSON.stringify(collapsed);
    }, [collapsed]);

    const [showButton, setShowButton] = useState(true);
    const [msgs, setMsgs] = useState();
    useEffect(() => {
      const eventSource = HFS.getNotifications("chat", (e, data) => {
        if (e !== "newMessage") return;
        setMsgs((old) => [...old, data]);
        if (getCollapsedValue() || !getGoBottomValue()) setUnread((x) => x + 1);
      });
      fetch("/~/api/chat/list")
        .then((v) => v.json())
        .then((v) =>
          setMsgs(HFS._.map(v, (o, ts) => Object.assign(o, { ts })))
        );
      return () => {
        eventSource.then((v) => v.close());
      };
    }, []);

    const ref = useRef();
    const lastScrollListenerRef = useRef();
    let [goBottom, setGoBottom, getGoBottom] = HFS.misc.useStateMounted(true);
    const getGoBottomValue = getGoBottom.get || getGoBottom;

    const [unread, setUnread] = useState(0);
    useEffect(() => {
      if (!collapsed && goBottom) setUnread(0);
    }, [collapsed, goBottom]);

    useEffect(() => {
      const { current: el } = ref;
      if (goBottom) el?.scrollTo(0, el.scrollHeight);
    }, [goBottom, msgs, collapsed]);

    const openChat = () => {
      setShowButton(false);
      setCollapsed(false);
    };

    const closeChat = () => {
      setCollapsed(true);
      setTimeout(() => {
        setShowButton(true);
      }, 300);
    };

    return h(
      Fragment,
      {},
      collapsed &&
        showButton &&
        h(
          "button",
          {
            className: "chat-floating-button",
            onClick: openChat,
            title: "Open Chat",
          },
          h(ChatIcon),
          unread > 0 && h("span", { className: "unread-badge" }, unread)
        ),
      h(
        "div",
        { className: `chat-container ${collapsed ? "collapsed" : "expanded"}` },
        h(
          "div",
          {
            className: "chat-header",
          },
          h(
            "span",
            {},
            `Chat`,
            !username &&
              h(
                Fragment,
                {},
                ` as ${n} `,
                HFS.iconBtn(
                  "edit",
                  (e) => {
                    e.stopPropagation();
                    changeNick();
                  },
                  {
                    title: HFS.t("change nickname"),
                  }
                )
              ),
            unread > 0 && h("span", { className: "unread-indicator" }, unread)
          ),
          HFS.iconBtn("✕", closeChat, {
            title: HFS.t("Close chat"),
          })
        ),
        h(
          "div",
          {
            className: "chat-messages",
            ref(el) {
              ref.current = el;
              lastScrollListenerRef.current?.();
              lastScrollListenerRef.current = HFS.domOn(
                "scroll",
                ({ target: el }) =>
                  setGoBottom(
                    el.scrollTop + el.clientHeight >= el.scrollHeight - 3
                  ),
                { target: el }
              );
            },
          },
          anonCanRead
            ? msgs?.map((message, i) =>
                h(ChatMessage, {
                  key: i,
                  message,
                  previousMessage: msgs[i - 1],
                  nextMessage: msgs[i + 1],
                })
              )
            : "Anonymous users can't view messages"
        ),
        h(
          "form",
          {
            async onSubmit(e) {
              e.preventDefault();
              if (!anonCanWrite) return;
              const trim = m.trim();
              if (!trim) return;
              const res = await fetch("/~/api/chat/add", {
                "Content-Type": "application/json",
                method: "POST",
                body: JSON.stringify({ n: username ? undefined : n, m: trim }),
              });
              httpCodeToast(res.status);
              if (res.status >= 200 && res.status < 300) sm("");
            },
          },
          h("input", {
            value: m,
            ref(e) {
              e?.focus();
            },
            disabled: !anonCanWrite,
            onChange(e) {
              if (e.target.value.length <= conf.maxMsgLen) sm(e.target.value);
            },
            placeholder: anonCanWrite
              ? undefined
              : "Anonymous users can't send messages",
          }),
          h(
            "button",
            {
              type: "submit",
              className: "chat-send-button",
              disabled: !m.trim() || !anonCanWrite,
              title: "Send message",
            },
            h(SendIcon)
          ),
          h(
            "div",
            {
              className: "chat-charcounter",
              style: {
                color: m.length === conf.maxMsgLen ? "#fe5757" : undefined,
              },
            },
            `${m.length}/${conf.maxMsgLen}`
          )
        )
      )
    );

    function changeNick() {
      HFS.dialogLib
        .promptDialog("Your name", { value: n })
        .then((x) => x && sn(x));
    }
  }

  function ChatApp() {
    const [isBanned, setIsBanned] = useState(true);
    useEffect(() => {
      fetch("/~/api/chat/banned")
        .then((v) => v.json())
        .then((v) => setIsBanned(v))
        .catch((e) => {
          console.error("server error:", e);
          setIsBanned(true);
        });
    });
    return isBanned || (!anonCanRead && !anonCanWrite)
      ? null
      : h(ChatContainer);
  }
}

/**
 * todo:
 * frontend configs change
 * resizable chat container
 * new messages when not scrolled to bottom and on collapsed, persisted in localstorage
 * users that can write and read
 * .msg-admin message class if message is from an administrator
 */

