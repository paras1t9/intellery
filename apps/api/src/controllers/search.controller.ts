import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { searchService } from "../composition/index.js";
import { SearchBody, SearchParams } from "../schemas/search.schema.js";

export async function search(req: Request, res: Response) {
  const userId  = req.user.id;
  const { eventId } = req.params as unknown as SearchParams;
  const { query, limit } = req.body as SearchBody;

  const result = await searchService.search(userId, eventId, query, limit);

  res.status(StatusCodes.OK).json({
    success: true,
    data: result,
  });
}
