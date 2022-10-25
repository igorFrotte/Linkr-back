import { checkIfPostIsPostedByUser, deletePostData, updatePostData, insertPostData } from "../repositories/posts.repository.js";
import { postSchema, postUpdateSchema } from "../schemas/postSchema.js";
import { getUserById, getPostsByUser, getAllPosts } from "../repositories/users.repository.js";
import urlMetadata from 'url-metadata';
import { STATUS_CODE } from "../enums/statusCode.js";
import { getPostById } from "../repositories/likes.repository.js";
import { getPostTrendsByPostId } from "../repositories/trends.repository.js";

async function updatePost (req, res) {
    const validation = postUpdateSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }
    
    const { postId, userId } = res.locals;
    const { newDescription, newTrends } = req.body;

    try {
        const postCheck = (await checkIfPostIsPostedByUser(postId, userId));
        if (!postCheck.rowCount) return res.status(401).send("Post not made by user");

        await updatePostData(postCheck.rows[0].id, newDescription, newTrends);

        return res.sendStatus(204);
    } catch (error) {
        return res.status(500).send(error);
    }
}

async function deletePost (req, res) {
    const { postId, userId } = res.locals;

    try {
        const postCheck = (await checkIfPostIsPostedByUser(postId, userId));
        if (!postCheck.rowCount) return res.status(401).send("Post not made by user");

        await deletePostData(postCheck.rows[0].id);

        return res.sendStatus(202);
    } catch (error) {
        return res.status(500).send(error);
    }
}

async function createPost (req, res) {
    const { link, description, trends } = req.body;
    const validation = postSchema.validate(req.body);

    if(validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    const urlTester = new RegExp(
        '^(https?:\\/\\/)?'+'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+'((\\d{1,3}\\.){3}\\d{1,3}))'+
	    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+'(\\?[;&a-z\\d%_.~+=-]*)?'+'(\\#[-a-z\\d_]*)?$','i'
    );

    if(!urlTester.test(link)) {
        return res.status(422).send('URL inválida!');
    } 

    const { userId } = res.locals; 

    try {
        await insertPostData( userId, link, description, trends );

        return res.sendStatus(201);
    } catch (error) {
        res.status(500).send(error.message);
    } 
}

async function postsByUser (req, res) {
    const { id } = req.params;

    try {
        const user = (await getUserById(id)).rows;
        if (!user.length) return res.status(404).send('User not found');
        
        const posts = (await getPostsByUser(user[0].id)).rows;

        const postsData = [];

        for (let i = 0; i < posts.length; i ++) {
            postsData.push(await InsertIntoPostDataUrlMetadata(posts[i]))
        }

        return res.status(200).send({user: {username: user[0].username, picture:  user[0].picture}, posts: postsData});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

async function allPosts (req, res) {
    try {

        let posts = (await getAllPosts()).rows;

        const postsData = [];

        for (let i = 0; i < posts.length; i ++) {
            postsData.push(await InsertIntoPostDataUrlMetadata(posts[i]))
        }

        return res.status(200).send(postsData);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

async function InsertIntoPostDataUrlMetadata (postData) {
    const link = postData.link;
    const metadata = await urlMetadata(link);
    
    postData.linkTitle = metadata.title;
    postData.linkDescription = metadata.description;
    postData.linkImage = metadata.image;

    return postData
}

async function sharePost (req, res) {
    const { postId, userId } = res.locals;

    try {
        const postData = (await getPostById(postId)).rows[0];
        let postTrends = (await getPostTrendsByPostId(postId)).rows;
        postTrends = postTrends.map(trendObj => trendObj.name);

        await insertPostData(userId, postData.link, postData.description, postTrends, postId)

        return res.sendStatus(STATUS_CODE.CREATED)      
    } catch (error) {
        return res.status(STATUS_CODE.SERVER_ERROR).send(error.message);
    }

}

export {
    updatePost,
    deletePost,
    createPost,
    postsByUser,
    allPosts,
    InsertIntoPostDataUrlMetadata,
    sharePost
}