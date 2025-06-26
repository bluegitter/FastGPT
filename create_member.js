const now = new Date();
const newTeamId = ObjectId(); // 生成一个新的团队 ID

const username = "test";
const password = "123456";

const hash1 = crypto.createHash('sha256').update(password).digest('hex');
const hash2 = crypto.createHash('sha256').update(hash1).digest('hex');

// 插入用户
const user = db.users.insertOne({
  username,
  password: hash2,
  status: "active",
  avatar: "/icon/human.svg",
  balance: NumberInt(100000),
  promotionRate: NumberInt(10),
  timezone: "Asia/Shanghai",
  createTime: now,
  __v: 0
});

// 取出用户ID
const userId = user.insertedId;

// 插入团队
db.teams.insertOne({
  _id: newTeamId,
  name: 'Test Team',
  ownerId: userId,
  avatar: '/icon/team.svg',
  createTime: now,
  balance: 100000,
  maxSize: 10,
  __v: 0
});

// 插入成员
db.team_members.insertOne({
  _id: ObjectId(),
  teamId: newTeamId,
  userId: userId,
  name: 'Owner',
  status: 'active',
  role: 'owner',
  avatar: '/icon/human.svg',
  createTime: now,
  __v: 0
});
