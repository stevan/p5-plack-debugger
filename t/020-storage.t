#!/usr/bin/perl

use strict;
use warnings;

use JSON::XS;
use Path::Class qw[ dir ];

use Test::More;
use Test::Fatal;

BEGIN {
    use_ok('Plack::Debugger::Storage');
}

my $JSON     = JSON::XS->new->utf8->pretty;
my $DATA_DIR = dir('./t/020-tmp-storage/');

# cleanup tmp dir
{ ((-f $_ && $_->remove) || (-d $_ && $_->rmtree)) foreach $DATA_DIR->children( no_hidden => 1 ) }

my $storage = Plack::Debugger::Storage->new(
    data_dir     => $DATA_DIR,
    serializer   => sub { $JSON->encode( shift ) },
    deserializer => sub { $JSON->decode( shift ) },
    filename_fmt => "%s.json",
);

{
    is($storage->data_dir,     $DATA_DIR, '... got the expected data_dir');
    is($storage->filename_fmt, '%s.json', '... got the expected filename_fmt');

    ok($storage->serializer,   '... got a serializer as expected');
    ok($storage->deserializer, '... got a deserializer as expected');
}

# STORE and FETCH a simple request result ...
{
    ok(!-e $DATA_DIR->file('1234.json'), '... the data file does not exist (yet)');

    my $request_uid     = '1234';
    my $request_results = { testing => [ 1, 2, 3, 4 ] };

    is(
        exception {
            $storage->store_request_results( $request_uid, $request_results );
        }, 
        undef, 
        '... stored request results successfully'
    );

    ok(-e $DATA_DIR->file('1234.json'), '... the data file does exist now');

    my $stored_results;
    is(
        exception {
            $stored_results = $storage->load_request_results( $request_uid )
        },
        undef,
        '... loaded request results successfully'
    );

    is_deeply( $request_results, $stored_results, '... got the same results back' );
}

# STORE and FETCH a subrequest result(s) ...
{
    ok(!-d $DATA_DIR->subdir('1234'), '... the subrequest data dir does not exist (yet)');

    my $request_uid        = '1234';
    my $subrequest_uid     = '5678';
    my $subrequest_results = { testing => [ 5, 6, 7, 8 ] };

    is(
        exception {
            $storage->store_subrequest_results( $request_uid, $subrequest_uid, $subrequest_results );
        }, 
        undef, 
        '... stored subrequest results successfully'
    );

    ok(-d $DATA_DIR->subdir('1234'), '... the subrequest data dir does exist now');

    my $stored_all_results;
    is(
        exception {
            $stored_all_results = $storage->load_all_subrequest_results( $request_uid )
        },
        undef,
        '... loaded all sub-request results successfully'
    );
    is_deeply( [ $subrequest_results ], $stored_all_results, '... got the same results back' );

    ok(-e $DATA_DIR->subdir('1234')->file('5678.json'), '... the subrequest data file does exist now');
    my $stored_subrequest_results;
    is(
        exception {
            $stored_subrequest_results = $storage->load_subrequest_results( $request_uid, $subrequest_uid )
        },
        undef,
        '... loaded specific sub-request results successfully'
    );
    is_deeply( $subrequest_results, $stored_subrequest_results, '... got the same results back' );
}

my $epoch = time;
diag('... sleeping for a second to ensure mtime is different enough');
sleep(1);

# STORE and FETCH a subset of subrequest result(s) ...
{
    my $request_uid        = '1234';
    my $subrequest_uid     = '9101112';
    my $subrequest_results = { testing => [ 9, 10, 11, 12 ] };

    is(
        exception {
            $storage->store_subrequest_results( $request_uid, $subrequest_uid, $subrequest_results );
        }, 
        undef, 
        '... stored subrequest results successfully'
    );

    ok(-e $DATA_DIR->subdir('1234')->file('5678.json'), '... the older subrequest data file still exists');
    ok(-e $DATA_DIR->subdir('1234')->file('9101112.json'), '... the subrequest data file does exist now');
    my $stored_subrequest_results;
    is(
        exception {
            $stored_subrequest_results = $storage->load_all_subrequest_results_modified_since( $request_uid, $epoch )
        },
        undef,
        '... loaded specific sub-request results successfully'
    );
    is(scalar(@$stored_subrequest_results), 1, '... only got one subrequest result back');
    is_deeply( [ $subrequest_results ], $stored_subrequest_results, '... got the same results back' );
}

done_testing;







