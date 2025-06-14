const postsCollection = require('../db').db().collection("posts")
const { ObjectId } = require('mongodb');
const User = require('./User')
const sanitizeHTML = require('sanitize-html')

let Post = function (data, userid, requestedPostId) {
this.data = data
this.errors = []
this.userid = userid
this.requestedPostId = requestedPostId
}

Post.prototype.cleanUp = function() {
  if (typeof(this.data.title) != "string") {
       this.data.title = ""
  }
  if (typeof(this.data.body) != "string") {
       this.data.body = ""
  }

  let objectUserId;
  try {
    objectUserId = ObjectId.createFromHexString(this.userid);
  } catch {
    objectUserId = null;
  }

  //get rid of bogus properties]
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {allowedTags: [], allowedAttributes: []}),
    body: sanitizeHTML(this.data.body.trim(), {allowedTags: [], allowedAttributes: []}),
    createdDate: new Date(),
    author: objectUserId
  }

}

Post.prototype.validate = function() {
   if (this.data.title == "") {
    this.errors.push("You must provide a title.")
   }
   if (this.data.body == "") {
    this.errors.push("You must provide content.")
   }
   if (!this.data.author) {
    this.errors.push("Invalid user ID.");
  }
}

Post.prototype.create = function() {
  return new Promise((resolve, reject)=> {
     this.cleanUp()
     this.validate()
     if (!this.errors.length) {
        //save post into db
        postsCollection.insertOne(this.data).then((info)=>{
            resolve(info.insertedId)
        }).catch(()=>{
               this.errors.push("Please try again later")
               reject(this.errors)
        })
        
     } else {
        reject(this.errors)
     }
  })
}

Post.prototype.Update =  function() {
    return new Promise(async (resolve, reject) => {
        try {
            let post = await Post.findSingleById(this.requestedPostId, this.userid)
            if (post.isVisitorOwner) {
                //actually update db
                let status = await this.actuallyUpdate()
              resolve(status)
            } else {
               reject()
            }

        } catch (error) {
            reject()
        }
    })
}

Post.prototype.actuallyUpdate = function () {
    return new Promise(async (resolve, reject)=>{
      this.cleanUp()
      this.validate()
      if (!this.errors.length) {
       await postsCollection.findOneAndUpdate({_id: new ObjectId(this.requestedPostId)}, {$set: {title: this.data.title, body: this.data.body}} )
       resolve("success")
      } else {
        resolve("failure")
      }
    })
}

Post.reuseablePostQuery = function(uniqueOperations, visitorId, finalOperations = []) {
    return new Promise(async function(resolve, reject){
          let aggOperations = uniqueOperations.concat([
            {$lookup: {from: "users", localField: "author", foreignField: "_id", as: "authorDocument"}},
            {$project: {title: 1, body: 1, createdDate: 1, authorId: "$author", author: {$arrayElemAt: ["$authorDocument", 0]}}}
        ]).concat(finalOperations)
          let posts = await postsCollection.aggregate(aggOperations).toArray()

          let visitorObjectId = null;
          if (typeof visitorId === 'string' && ObjectId.isValid(visitorId)) {
            visitorObjectId = new ObjectId(visitorId);
          }
          //clean up author property in each post object
          posts = posts.map(function(post){
            post.isVisitorOwner = visitorObjectId && post.authorId.equals(visitorObjectId);
            post.authorId = undefined

            post.author = {
                username: post.author?.username || "Unknown",
                avatar: new User(post.author || {}, true).avatar
              };
             
            return post
            
          })
         resolve(posts)   
         
        
    })
  }

Post.findSingleById = function(postId, visitorId) {
  return new Promise(async function(resolve, reject){
      if (typeof(postId) != "string" || !ObjectId.isValid(postId)) {
        reject("Invalid ID")
        return
      } 
       let posts = await Post.reuseablePostQuery([
        {$match: {_id: new ObjectId(postId)}}
       ], visitorId)
        if (posts.length) {
         resolve(posts[0])
        } else {
           reject("Post not found")
        }

       
  })
}

Post.findByAuthorId = function(authorId) {
   return Post.reuseablePostQuery([
    {$match: {author: authorId}},
    {$sort: {createdDate: -1}}
   ])
}

Post.delete = function (postIdToDelete, currentUserId) {
    return new Promise(async function(resolve, reject) {
      try {
        let post = await Post.findSingleById(postIdToDelete, currentUserId)
        if (post.isVisitorOwner) {
          await postsCollection.deleteOne({_id: new ObjectId(postIdToDelete)})
          resolve()
        } else {
          reject("No permissions for that action")
        }
      } catch (error) {
        reject("does not exist")
      }
    })
  }

  Post.search = function(searchTerm){
    return new Promise(async (resolve, reject) => {
       if (typeof(searchTerm) == "string" && searchTerm.trim().length) {
          let posts = await Post.reuseablePostQuery(
          [
            {$match: {$text: {$search: searchTerm}}},
            { $addFields: { score: { $meta: "textScore" } } }         
          ], undefined, [{$sort: {score: -1}}])
          resolve(posts)
       } else {
          reject()
       }
    })
  }


module.exports = Post