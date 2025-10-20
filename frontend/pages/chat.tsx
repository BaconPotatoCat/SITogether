import Head from 'next/head'

interface Conversation {
  id: number
  name: string
  lastMessage: string
  time: string
  avatarUrl: string
}

const DUMMY_CONVERSATIONS: Conversation[] = [
  { id: 1, name: 'Kira Belle', lastMessage: 'JRPG recs for tonight?', time: '2m', avatarUrl: 'https://images.unsplash.com/photo-1721440171951-26505bbe23cb?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687' },
  { id: 2, name: 'Aqua Nova', lastMessage: 'Karaoke collab when?', time: '12m', avatarUrl: 'https://images.unsplash.com/photo-1663035309414-07fe9174d7d6?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1936' },
  { id: 3, name: 'Star Lumi', lastMessage: 'Sketching stream soon ✨', time: '1h', avatarUrl: 'https://images.unsplash.com/photo-1758207575528-6b80f80f4408?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687' },
  { id: 4, name: 'Miko-chan', lastMessage: 'Packed you a virtual bento!', time: '3h', avatarUrl: 'https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1170' },
  { id: 5, name: 'Airi Sky', lastMessage: 'Queue up for a quick match?', time: '5h', avatarUrl: 'https://images.unsplash.com/photo-1727409048076-182d2907a59e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=987' },
  { id: 6, name: 'Neko Mika', lastMessage: 'New craft idea! 🧶', time: '1d', avatarUrl: 'https://images.unsplash.com/photo-1693240531477-bc6525187514?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687' },
]

export default function Chat() {
  return (
    <>
      <Head>
        <title>SITogether • Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        <h1>Chats</h1>
        <div className="chat-list">
          {DUMMY_CONVERSATIONS.map((c) => (
            <article key={c.id} className="chat-item">
              <img className="chat-avatar" src={c.avatarUrl} alt={`${c.name} avatar`} />
              <div className="chat-body">
                <div className="chat-head">
                  <h3>{c.name}</h3>
                  <span className="time">{c.time}</span>
                </div>
                <p className="last">{c.lastMessage}</p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  )
}
