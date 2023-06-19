const dbWrapper = require('./database');
const db = require('./database').db;

const init = async () => {
  await dbWrapper.run('CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, name varchar(32));');
  await dbWrapper.run('CREATE TABLE Friends (id INTEGER PRIMARY KEY AUTOINCREMENT, userId int, friendId int);');
  const users = [];
  const names = ['foo', 'bar', 'baz'];
  for (i = 0; i < 27000; ++i) {
    let n = i;
    let name = '';
    for (j = 0; j < 3; ++j) {
      name += names[n % 3];
      n = Math.floor(n / 3);
      name += n % 10;
      n = Math.floor(n / 10);
    }
    users.push(name);
  }
  const friends = users.map(() => []);
  for (i = 0; i < friends.length; ++i) {
    const n = 10 + Math.floor(90 * Math.random());
    const list = [...Array(n)].map(() => Math.floor(friends.length * Math.random()));
    list.forEach((j) => {
      if (i === j) {
        return;
      }
      if (friends[i].indexOf(j) >= 0 || friends[j].indexOf(i) >= 0) {
        return;
      }
      friends[i].push(j);
      friends[j].push(i);
    });
  }
  console.log("Init Users Table...");
  await Promise.all(users.map((un) => dbWrapper.run(`INSERT INTO Users (name) VALUES ('${un}');`)));
  console.log("Init Friends Table...");
  await Promise.all(friends.map((list, i) => {
    return Promise.all(list.map((j) => dbWrapper.run(`INSERT INTO Friends (userId, friendId) VALUES (${i + 1}, ${j + 1});`)));
  }));
  console.log("Ready.");
}
module.exports.init = init;

const search = async (req, res) => {
  const query = req.params.query;
  const userId = parseInt(req.params.userId);

  const sqlQuery0 = `
    DROP TABLE IF EXISTS temp_friends;
  `;

  const sqlQuery1 = `
    CREATE temp table temp_friends
    as 
    SELECT Friends.friendId id, FriendsInfo."name" name, 1 as connection FROM Users
    INNER JOIN Friends
    ON Users.id = Friends.userId
    AND Users.id = ${userId}
    INNER JOIN Users as FriendsInfo
    ON FriendsInfo.id = Friends.friendId
    AND FriendsInfo.name LIKE '${query}%';
  `;

  const sqlQuery2 = `
    INSERT INTO temp_friends
    
      SELECT Friends.friendId id, FriendsInfo."name" name, 2 as connection 
        FROM Users INNER JOIN Friends
        ON Users.id = Friends.userId
        AND Users.id IN (SELECT id from temp_friends)
        INNER JOIN Users as FriendsInfo
        ON FriendsInfo.id = Friends.friendId
        AND Friends.friendId NOT IN (SELECT id from temp_friends)
        AND FriendsInfo.name LIKE '${query}%';`

  const sqlQuery3 = `
    INSERT INTO temp_friends
    
      SELECT Friends.friendId id, FriendsInfo."name" name, 3 as connection 
        FROM Users INNER JOIN Friends
        ON Users.id = Friends.userId
        AND Users.id IN (SELECT id from temp_friends WHERE connection = 2)
        INNER JOIN Users as FriendsInfo
        ON FriendsInfo.id = Friends.friendId
        AND Friends.friendId NOT IN (SELECT id from temp_friends)
        AND FriendsInfo.name LIKE '${query}%';`

  const sqlQuery4 = `INSERT INTO temp_friends

      SELECT Friends.friendId id, FriendsInfo."name" name, 4 as connection
        FROM Users INNER JOIN Friends
        ON Users.id = Friends.userId
        AND Users.id IN (SELECT id from temp_friends WHERE connection = 3)
        INNER JOIN Users as FriendsInfo
        ON FriendsInfo.id = Friends.friendId
        AND Friends.friendId NOT IN (SELECT id from temp_friends)
        AND FriendsInfo.name LIKE '${query}%';
  `;

  const sqlQuery5 = `
    SELECT *, 1 sort_order FROM temp_friends
    UNION
    SELECT *, 0 connection, 2 sort_order FROM Users where id NOT IN (SELECT id from temp_friends) and name like '${query}%'
    ORDER BY sort_order ASC, connection asc
    LIMIT 20;
  `;

  // db.all(sqlQuery1).then((results) => {
  //   console.log('resuts------->', results)
  //   res.statusCode = 200;
  //   res.json({
  //     success: true,
  //     users: results
  //   });
  // }).catch((err) => {
  //   console.log('err----2!!!!>', err);
  //   res.statusCode = 501;
  //   res.json({success: false, error: err});
  // });

  db.serialize(() => {
    db.all(sqlQuery0);
    db.all(sqlQuery1);
    db.all(sqlQuery2);
    db.all(sqlQuery3);
    db.all(sqlQuery4);
    db.all(sqlQuery5, (err, results) => {
      res.statusCode = 200;
      res.json({
        success: true,
        users: results
      });
    });
  })
  // db.run(sqlQuery1).then((results) => {
  //   dbWrapper.all(`SELECT id, name, id in (SELECT friendId from Friends where userId = ${userId}) as connection from Users where name LIKE '${query}%' LIMIT 20;`).then((results) => {
  //   console.log('resuults', results)
  //     res.statusCode = 200;
  //     res.json({
  //       success: true,
  //       users: results
  //     });
  //   }).catch((err) => {
  //     console.log('err---->', err);
  //     res.statusCode = 500;
  //     res.json({success: false, error: err});
  //   });

  // res.statusCode = 200;
  //     res.json({
  //       success: true,
  //       users: []
  //     });
}

const friend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);

  dbWrapper.run(`INSERT INTO Friends (userId, friendId) VALUES (${userId}, ${friendId});`).then((results) => {
    res.statusCode = 200;
    res.json({
      success: true,
      users: results
    });
  }).catch((err) => {
    res.statusCode = 500;
    res.json({ success: false, error: err });
  });
}

const unfriend = async (req, res) => {
  const userId = parseInt(req.params.userId);
  const friendId = parseInt(req.params.friendId);

  dbWrapper.run(`DELETE FROM Friends WHERE userId = ${userId} AND friendId = ${friendId};`).then((results) => {
    res.statusCode = 200;
    res.json({
      success: true,
      users: results
    });
  }).catch((err) => {
    res.statusCode = 500;
    res.json({ success: false, error: err });
  });
}

module.exports.friend = friend;
module.exports.unfriend = unfriend;
module.exports.search = search;
