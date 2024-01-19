module.exports = (app) => {
    const express = require("express");
    const categories = require("../controllers/categoryController.js");
    const router = express.Router();
    const checkRole = require('../middleware/checkRole');

   
    router.post("/",checkRole.checkAdminRole, categories.create);

    router.get("/", categories.findAll);

    router.put("/:id", checkRole.checkAdminRole, categories.update);

    router.delete("/:id", checkRole.checkAdminRole, categories.delete);

    router.get("/withBookCount", categories.getBookCountByCategory);

    app.use("/api/categories", router);
};
