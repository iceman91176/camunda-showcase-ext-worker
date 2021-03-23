const { Client : ESClient } = require('@elastic/elasticsearch')

const esClient = new ESClient({ node: process.env.ES_HOST });

const indexDocument = async (index,someDoc) => {

    let res = await esClient.index({
        index:index,
        body: someDoc
    }).catch((err) => {
      throw new Error(err);
    });

    console.log(`Document created with id ${res.body._id}`);
    return;

};

exports.indexDocument = indexDocument;
