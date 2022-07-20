FROM python:alpine3.16

RUN python -m pip install --upgrade pip
COPY . /app
RUN pip install -r /app/requirements.txt

ENTRYPOINT ["python3"]
CMD ["/script/build_extension.py"]
CMD ["/app/source/server/main.py","debug"]
