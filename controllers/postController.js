const Post = require('../models/Post')


exports.viewCreateScreen = function(req, res){
  res.render('create-post')
}

exports.create = function(req, res) {
  let post = new Post(req.body, req.session.user._id)
  post.create().then(function(newId){
      req.flash("success", "New post successfully created")
      req.session.save(() => res.redirect(`/post/${newId}`))
  }).catch(function(errors){
      errors.forEach(error => req.flash("errors", error))
      req.session.save(() => res.redirect("/create-post"))
  })

}

exports.apiCreate = function(req, res) {
  let post = new Post(req.body, req.apiUser._id)
  post.create().then(function(newId){
     res.json("Congrats.")
  }).catch(function(errors){
      res.json(errors)
  })

}

exports.viewSingle = async function(req, res) {
    
    try {
        let post = await Post.findSingleById(req.params.id, req.visitorId)
        res.render('single-post-screen', {post: post, title: post.title})
        
       
    } catch (error) {
        res.render('404')
    }
}

exports.viewEditScreen = async function(req, res) {
    try {
        let post = await Post.findSingleById(req.params.id, req.visitorId)
        if (post.isVisitorOwner) {
          res.render("edit-post", {post: post})
        } else {
          req.flash("errors", "You do not have permission to perform that action.")
          req.session.save(() => res.redirect("/"))
        }
      } catch {
        res.render("404")
      }
    }

exports.edit = function(req, res) {
   let post = new Post(req.body, req.visitorId, req.params.id)
   post.Update().then((status)=>{
     //successful updated post
     //validation errors
     if (status == "success") {
          //post was updated in db
          req.flash("success", "Post successfully updated.")
          req.session.save(function() {
            res.redirect(`/post/${req.params.id}/edit`)
          })
     } else {
        post.errors.forEach(function(error) {
             req.flash("errors", error)
        })
        req.session.save(function() {
            res.redirect(`/post/${req.params.id}/edit`)
        })
     }
   }).catch(()=>{
    //a post that does not exist
    //if the current visitor is not the owner
    req.flash("errors", "You do not have permission to perform that action.")
    req.session.save(function() {
        res.redirect("/")
    })
   })
}

exports.delete = function(req, res) {
    Post.delete(req.params.id, req.visitorId).then(()=> {
       req.flash("success", "Post sucessfully deleted.")
       req.session.save(() => {res.redirect(`/profile/${req.session.user.username}`)})
    }).catch(()=>{
      req.flash("errors", "You do not have permission for that action")
      req.session.save(() => res.redirect("/"))
  
    })
  }

exports.apiDelete = function(req, res) {
    Post.delete(req.params.id, req.apiUser._id).then(()=> {
      res.json("Success")
    }).catch(()=>{
      res.json("No permissions for this action.")
  
    })
  }

  exports.search = function(req, res){
    Post.search(req.body.searchTerm).then((posts)=>{
       res.json(posts)
    }).catch(()=>{
        res.json([])
    })
  }