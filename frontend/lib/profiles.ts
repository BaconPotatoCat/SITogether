export interface Profile {
  id: number
  name: string
  age: number
  course: string
  interests: string[]
  bio: string
  avatarUrl: string
}

export const PROFILES: Profile[] = [
  {
    id: 1,
    name: 'Kira Belle',
    age: 23,
    course: 'CSC',
    interests: ['Programming', 'Gaming', 'Tech'],
    bio: "Computer Science student who loves coding and gaming. Let's study algorithms together!",
    avatarUrl:
      'https://images.unsplash.com/photo-1721440171951-26505bbe23cb?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687',
  },
  {
    id: 2,
    name: 'Aqua Nova',
    age: 21,
    course: 'EEE',
    interests: ['Electronics', 'Robotics', 'Innovation'],
    bio: "Electrical Engineering student passionate about robotics and innovation. Let's build something amazing!",
    avatarUrl:
      'https://images.unsplash.com/photo-1663035309414-07fe9174d7d6?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1936',
  },
  {
    id: 3,
    name: 'Star Lumi',
    age: 22,
    course: 'CDM',
    interests: ['Design', 'Media', 'Creativity'],
    bio: 'Communication and Digital Media student. Love creating content and exploring new media trends.',
    avatarUrl:
      'https://images.unsplash.com/photo-1758207575528-6b80f80f4408?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687',
  },
  {
    id: 4,
    name: 'Miko-chan',
    age: 20,
    course: 'NUR',
    interests: ['Healthcare', 'Wellness', 'Community'],
    bio: "Nursing student dedicated to helping others. Let's study healthcare together and make a difference!",
    avatarUrl:
      'https://images.unsplash.com/flagged/photo-1572491259205-506c425b45c3?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1170',
  },
  {
    id: 5,
    name: 'Airi Sky',
    age: 24,
    course: 'MEC',
    interests: ['Engineering', 'Innovation', 'Problem Solving'],
    bio: "Mechanical Engineering student who loves solving complex problems. Let's tackle challenging projects together!",
    avatarUrl:
      'https://images.unsplash.com/photo-1727409048076-182d2907a59e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=987',
  },
  {
    id: 6,
    name: 'Neko Mika',
    age: 19,
    course: 'PHT',
    interests: ['Health', 'Fitness', 'Wellness'],
    bio: "Physiotherapy student passionate about movement and wellness. Let's study anatomy and help people recover!",
    avatarUrl:
      'https://images.unsplash.com/photo-1693240531477-bc6525187514?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687',
  },
]

export function getProfileById(id: number): Profile | undefined {
  return PROFILES.find((p) => p.id === id)
}

// Current logged-in user profile
export const CURRENT_USER: Profile = {
  id: 0,
  name: 'You',
  age: 22,
  course: 'CSC',
  interests: ['Coding', 'Gaming', 'Tech'],
  bio: 'Computer Science student passionate about building amazing things!',
  avatarUrl:
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687',
}
