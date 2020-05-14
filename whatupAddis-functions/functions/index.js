const functions = require("firebase-functions");

const { db } = require("./util/admin");
const app = require("express")();
const FBAuth = require("./util/fbAuth");
exports.getlist;
const {
  getAllLists,
  postOneList,
  getlist,
  commentOnList,
  unlikeList,
  likeList,
  deleteList,
} = require("./handlers/lists");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  markNotificationsRead,
  getUserDetails,
} = require("./handlers/users");
const fbAuth = require("./util/fbAuth");

//Getting from the database and posting
app.get("/lists", getAllLists);
app.post("/list", FBAuth, postOneList);
//Detail Listing
app.get("/list/:listId", getlist);
//users route
//signup Route
app.post("/signup", signup);
//Users
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);
//Loging in
app.post("/login", login);
//Post pic
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
//Like
app.get("/user", FBAuth, getAuthenticatedUser);

//Post comment
app.post("/list/:listId/comment", FBAuth, commentOnList);

//Like a post
app.get("/list/:listId/like", FBAuth, likeList);
//Unlike list
app.get("/list/:listId/unlike", FBAuth, unlikeList);
//Delete list
app.delete("/list/:listId", FBAuth, deleteList);

exports.api = functions.https.onRequest(app);

//Like notification
exports.createNotificationOnLike = functions.firestore
  .document(`likes/{id}`)
  .onCreate((snapshot) => {
    db.doc(`/lists/${snapshot.data().listId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            listId: doc.id,
          });
        }
      })
      .catch((err) => console.error(err));
  });

//delete notifications on unlike
exports.deleteNotificationOnUnlike = functions.firestore
  .document(`likes/{id}`)
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()

      .catch((err) => {
        console.error(err);
        return;
      });
  });

//Comment notification
exports.createNotificationsOnComment = functions.firestore
  .document(`comments/{id}`)
  .onCreate((snapshot) => {
    return db
      .doc(`/lists/${snapshot.data().listId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            listId: doc.id,
          });
        }
      })

      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onUserImageChange = functions.firestore
  .document("/users/{userId}")
  .onUpdate((change) => {
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("Image has changed");
      const batch = db.batch();

      return db
        .collection("lists")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const list = db.doc(`/lists/${doc.id}`);
            batch.update(list, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });
exports.onListDelete = functions.firestore
  .document("/lists/{listId}")
  .onDelete((snapshot, context) => {
    const listId = context.params.listId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("listId", "==", listId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("listId", "==", listId).get();
      })

      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("listId", "==", listId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
