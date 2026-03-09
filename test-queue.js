const userQueues = new Map();

function enqueueUserTask(userId, task) {
    const currentQueue = userQueues.get(userId) || Promise.resolve();
    const nextQueue = currentQueue.then(async () => {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error("Timeout: La tarea tardó más de 5 segundos en completarse."));
            }, 5000);
        });

        try {
            await Promise.race([task(), timeoutPromise]);
        } finally {
            clearTimeout(timeoutId);
        }
    }).catch(error => {
        console.error(`❌ Queued task error for user ${userId}:`, error.message);
    });
    userQueues.set(userId, nextQueue);
    return nextQueue;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log("Adding task 1 (hangs forever)");
enqueueUserTask("user1", async () => {
    console.log("Task 1 started");
    await sleep(10000); // hangs longer than 5s
    console.log("Task 1 finished");
});

console.log("Adding task 2 (fast)");
enqueueUserTask("user1", async () => {
    console.log("Task 2 started");
    await sleep(1000);
    console.log("Task 2 finished");
});

console.log("Adding task 3 (throws)");
enqueueUserTask("user1", async () => {
    console.log("Task 3 started");
    throw new Error("Task 3 died");
});

console.log("Adding task 4 (fast)");
enqueueUserTask("user1", async () => {
    console.log("Task 4 started");
    await sleep(1000);
    console.log("Task 4 finished");
});
